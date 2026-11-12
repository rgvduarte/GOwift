//! Server messages as WebSocket frames (`docs/protocol.md`, Compression).
//!
//! Messages are JSON text frames, unless the client offered `deflate-raw` in
//! `hello` and the `welcome` agreed to it. That welcome is the last text frame:
//! every later message is a binary frame holding its JSON and a newline,
//! raw-deflated on one stream for the whole connection and sync-flushed, so a
//! frame decodes completely once the frames before it are decoded. The shared
//! stream is what makes state cheap: names, keys and road ids repeat in every
//! state and cost a few bytes after their first time.
//!
//! This is permessage-deflate (RFC 7692) done in the application, because the
//! server's WebSocket stack (tungstenite) does not implement the extension.

use crate::protocol::{FrameCompression, ServerMessage};
use flate2::{Compress, Compression, FlushCompress};

/// Measured on recorded state: level 3 sends a twelfth of the JSON, level 6 a
/// fourteenth at twice the CPU, level 1 only a sixth.
const LEVEL: u32 = 3;

/// One outgoing WebSocket frame.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Frame {
    Text(String),
    Binary(Vec<u8>),
}

/// Encodes one connection's messages in order; it keeps the deflate stream.
#[derive(Default)]
pub struct FrameEncoder {
    deflate: Option<Compress>,
}

impl FrameEncoder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn encode(&mut self, message: &ServerMessage) -> Frame {
        let json = message.to_json();
        let Some(deflate) = &mut self.deflate else {
            if let ServerMessage::Welcome {
                compression: Some(FrameCompression::DeflateRaw),
                ..
            } = message
            {
                self.deflate = Some(Compress::new(Compression::new(LEVEL), false));
            }
            return Frame::Text(json);
        };
        let mut line = json.into_bytes();
        line.push(b'\n');
        Frame::Binary(deflate_and_flush(deflate, &line))
    }
}

/// Deflates `input` and sync-flushes, so the output ends on a byte boundary
/// with everything decodable.
fn deflate_and_flush(deflate: &mut Compress, input: &[u8]) -> Vec<u8> {
    // Deflate output never exceeds the input by more than a few bytes per block.
    let mut out = Vec::with_capacity(input.len() + 64);
    let start = deflate.total_in();
    loop {
        let consumed = (deflate.total_in() - start) as usize;
        deflate
            .compress_vec(&input[consumed..], &mut out, FlushCompress::Sync)
            .expect("deflating into memory cannot fail");
        // The flush is complete once all input is taken and output space is left over.
        if deflate.total_in() - start == input.len() as u64 && out.len() < out.capacity() {
            return out;
        }
        out.reserve(out.capacity());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{RaceState, RouteRiders, PROTOCOL_VERSION};
    use flate2::{Decompress, FlushDecompress};

    fn welcome(compression: Option<FrameCompression>) -> ServerMessage {
        ServerMessage::Welcome {
            protocol_version: PROTOCOL_VERSION,
            server_name: "Club".into(),
            server_version: "1.0.0".into(),
            auth_mode: "open".into(),
            route_id: "loop".into(),
            grace_s: 60.0,
            compression,
        }
    }

    fn state(tick: u64) -> ServerMessage {
        ServerMessage::State {
            tick,
            riders: vec![],
            race: RaceState::Idle,
            route_riders: RouteRiders {
                humans: 1,
                bots: 12,
                remote: 0,
            },
            event: None,
            vehicle: None,
        }
    }

    /// Inflates one binary frame on the connection's single raw-deflate stream.
    fn inflate(stream: &mut Decompress, frame: &[u8]) -> String {
        let before = stream.total_in();
        let mut out = Vec::with_capacity(64 * 1024);
        stream
            .decompress_vec(frame, &mut out, FlushDecompress::Sync)
            .expect("valid deflate data");
        assert_eq!(
            stream.total_in() - before,
            frame.len() as u64,
            "a frame is one whole flush"
        );
        String::from_utf8(out).expect("UTF-8 JSON")
    }

    #[test]
    fn messages_are_json_text_frames_by_default() {
        let mut encoder = FrameEncoder::new();
        assert_eq!(encoder.encode(&state(1)), Frame::Text(state(1).to_json()));
    }

    #[test]
    fn a_welcome_without_compression_keeps_text_frames() {
        let mut encoder = FrameEncoder::new();
        encoder.encode(&welcome(None));
        assert_eq!(encoder.encode(&state(1)), Frame::Text(state(1).to_json()));
    }

    #[test]
    fn the_welcome_naming_deflate_raw_is_still_a_text_frame() {
        let mut encoder = FrameEncoder::new();
        let message = welcome(Some(FrameCompression::DeflateRaw));
        assert_eq!(encoder.encode(&message), Frame::Text(message.to_json()));
    }

    #[test]
    fn after_a_deflate_raw_welcome_each_frame_inflates_to_one_json_line() {
        let mut encoder = FrameEncoder::new();
        encoder.encode(&welcome(Some(FrameCompression::DeflateRaw)));
        let mut stream = Decompress::new(false);
        for tick in 1..=3 {
            let Frame::Binary(bytes) = encoder.encode(&state(tick)) else {
                panic!("expected a binary frame");
            };
            assert_eq!(inflate(&mut stream, &bytes), format!("{}\n", state(tick).to_json()));
        }
    }

    #[test]
    fn later_frames_reuse_what_earlier_frames_sent() {
        let mut encoder = FrameEncoder::new();
        encoder.encode(&welcome(Some(FrameCompression::DeflateRaw)));
        let size = |frame: Frame| match frame {
            Frame::Binary(bytes) => bytes.len(),
            Frame::Text(_) => panic!("expected a binary frame"),
        };
        let first = size(encoder.encode(&state(1)));
        let second = size(encoder.encode(&state(2)));
        assert!(second * 3 < first, "first {first} B, second {second} B");
    }
}
