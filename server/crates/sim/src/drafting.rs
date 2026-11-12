//! Drafting (riding in someone's slipstream).
//!
//! A rider up to `max_gap` metres behind another rider in the same lane gets a
//! reduced drag area. Gaps are measured middle to middle, so `min_gap` is about
//! a bike length: the closest a rider gets (see [`crate::spacing`]). The
//! reduction is largest from there on in and fades linearly to zero at `max_gap`.
//!
//! In a group the shelter grows (ADR 0025): deeper in a line of wheels, and
//! with riders just ahead in the lanes alongside, up to a cap for a bunch. The
//! rider in front of a wheel gains a little too: the air behind it no longer
//! drags at it as hard. Measured shelter for comparison: the second of two
//! riders up to 27.1 % less drag and the first up to 2.6 % less (Blocken et
//! al. 2013, Comput. Fluids 71:435–445); 45, 55 and 57 % for positions 2–4 of
//! a team pursuit line (Barry et al. 2015, Sports Eng. 18:93–103); 90–95 %
//! deep in a 121-rider peloton (Blocken et al. 2018, J. Wind Eng. Ind.
//! Aerodyn. 179:319–337). The game stays well below those: its riders hold a
//! perfect line, and no crosswind ever gaps anyone.

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DraftParams {
    pub min_gap: f64,
    pub max_gap: f64,
    /// Maximum relative CdA reduction on the first wheel, e.g. `0.3` for 30 %.
    pub max_reduction: f64,
    /// Maximum reduction on the 2nd, 3rd, and 4th-and-later wheel of a line;
    /// never less than the first wheel's.
    pub deeper_wheels: [f64; 3],
    /// Reduction each rider adds up to `side_gap` metres ahead in a
    /// neighbouring lane (at most `side_lanes` lanes off), for a rider on a wheel.
    pub side_per_rider: f64,
    pub side_gap: f64,
    pub side_lanes: f64,
    /// The most reduction a rider gets, however deep in a bunch.
    pub max_bunch: f64,
    /// Reduction for a rider with a wheel `min_gap` behind, fading out at `leader_gap`.
    pub leader: f64,
    pub leader_gap: f64,
    /// Riders whose lane positions differ by less than this share a lane.
    pub lane_tolerance: f64,
}

impl Default for DraftParams {
    fn default() -> Self {
        Self {
            min_gap: 2.0,
            max_gap: 6.5,
            max_reduction: 0.3,
            deeper_wheels: [0.40, 0.45, 0.48],
            side_per_rider: 0.04,
            side_gap: 4.0,
            side_lanes: 1.5,
            max_bunch: 0.60,
            leader: 0.026,
            leader_gap: 4.0,
            lane_tolerance: 0.5,
        }
    }
}

/// The wheel a rider follows in its lane.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Wheel {
    /// Metres to it, middle to middle.
    pub gap: f64,
    /// The reduction it gives the rider right behind it (its own
    /// [`DraftParams::max_reduction`]: more behind a beer bike).
    pub max_reduction: f64,
    /// Which wheel of the line the rider rides: 1 right behind its front,
    /// 2 behind that, and so on.
    pub depth: usize,
}

/// A rider's place in a group, as the draft sees it.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct GroupPlace {
    /// The wheel ahead in the rider's lane, if any.
    pub wheel: Option<Wheel>,
    /// Riders up to `side_gap` ahead in the lanes alongside.
    pub alongside: usize,
    /// Metres to the nearest rider on this rider's own wheel.
    pub gap_behind: Option<f64>,
}

impl DraftParams {
    /// CdA multiplier for a rider `gap` metres behind the next rider ahead.
    pub fn cda_factor(&self, gap: f64) -> f64 {
        self.follow(gap, self.max_reduction)
    }

    /// CdA multiplier for a rider at `place` in a group: the shelter of its
    /// wheel, deeper in the line and with riders alongside, times the little
    /// a wheel behind gives.
    pub fn group_factor(&self, place: &GroupPlace) -> f64 {
        let follow = place.wheel.map_or(1.0, |wheel| {
            let line = match wheel.depth {
                0 | 1 => wheel.max_reduction,
                deeper => self.deeper_wheels[(deeper - 2).min(self.deeper_wheels.len() - 1)].max(wheel.max_reduction),
            };
            let flanked = line + self.side_per_rider * place.alongside as f64;
            self.follow(wheel.gap, flanked.min(self.max_bunch.max(wheel.max_reduction)))
        });
        let lead = place.gap_behind.map_or(1.0, |gap| {
            let t = ((gap - self.min_gap) / (self.leader_gap - self.min_gap)).clamp(0.0, 1.0);
            1.0 - self.leader * (1.0 - t)
        });
        follow * lead
    }

    /// CdA multiplier `gap` metres behind a wheel that gives `reduction` at its
    /// closest, fading out linearly across the window.
    fn follow(&self, gap: f64, reduction: f64) -> f64 {
        if gap <= 0.0 || gap > self.max_gap {
            return 1.0;
        }
        let t = (gap.max(self.min_gap) - self.min_gap) / (self.max_gap - self.min_gap);
        1.0 - reduction * (1.0 - t)
    }

    pub fn same_lane(&self, lane_a: f64, lane_b: f64) -> bool {
        (lane_a - lane_b).abs() < self.lane_tolerance
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_reduction_right_behind_the_leader() {
        let p = DraftParams::default();
        assert!((p.cda_factor(2.0) - 0.7).abs() < 1e-9);
    }

    #[test]
    fn closer_than_a_bike_length_is_still_the_full_draft() {
        let p = DraftParams::default();
        assert!((p.cda_factor(1.2) - 0.7).abs() < 1e-9);
    }

    #[test]
    fn reduction_fades_out_linearly() {
        let p = DraftParams::default();
        assert!((p.cda_factor(4.25) - 0.85).abs() < 1e-9);
        assert!((p.cda_factor(6.5) - 1.0).abs() < 1e-9);
    }

    #[test]
    fn no_draft_beyond_the_window() {
        let p = DraftParams::default();
        assert_eq!(p.cda_factor(0.0), 1.0);
        assert_eq!(p.cda_factor(6.6), 1.0);
        assert_eq!(p.cda_factor(100.0), 1.0);
    }

    /// A rider `gap` metres behind a normal rider, `depth` wheels deep in the line.
    fn in_line(gap: f64, depth: usize) -> GroupPlace {
        GroupPlace {
            wheel: Some(Wheel {
                gap,
                max_reduction: DraftParams::default().max_reduction,
                depth,
            }),
            ..GroupPlace::default()
        }
    }

    #[test]
    fn depth_one_keeps_the_single_wheel_curve() {
        let p = DraftParams::default();
        for gap in [1.2, 2.0, 4.25, 6.5] {
            assert!(
                (p.group_factor(&in_line(gap, 1)) - p.cda_factor(gap)).abs() < 1e-12,
                "{gap}"
            );
        }
    }

    #[test]
    fn second_wheel_in_a_line_saves_more_than_the_first() {
        let p = DraftParams::default();
        assert!(p.group_factor(&in_line(2.0, 2)) < p.group_factor(&in_line(2.0, 1)));
    }

    #[test]
    fn the_fourth_wheel_and_later_save_alike() {
        let p = DraftParams::default();
        assert_eq!(p.group_factor(&in_line(2.0, 9)), p.group_factor(&in_line(2.0, 4)));
    }

    #[test]
    fn deeper_wheels_fade_out_across_the_same_window() {
        let p = DraftParams::default();
        assert_eq!(p.group_factor(&in_line(6.6, 3)), 1.0);
    }

    /// The draft 2 m behind the fourth wheel of a line with `alongside`
    /// riders in the lanes next to it.
    fn flanked(alongside: usize) -> f64 {
        DraftParams::default().group_factor(&GroupPlace {
            alongside,
            ..in_line(2.0, 4)
        })
    }

    #[test]
    fn each_rider_alongside_adds_its_share() {
        assert!((flanked(1) - (1.0 - 0.48 - 0.04)).abs() < 1e-12);
    }

    #[test]
    fn riders_alongside_add_no_more_than_the_bunch_cap() {
        assert!((flanked(10) - (1.0 - DraftParams::default().max_bunch)).abs() < 1e-12);
    }

    #[test]
    fn riders_alongside_shelter_nobody_without_a_wheel() {
        let p = DraftParams::default();
        let alone = GroupPlace {
            alongside: 3,
            ..GroupPlace::default()
        };
        assert_eq!(p.group_factor(&alone), 1.0);
    }

    #[test]
    fn the_leader_gains_a_little_from_a_wheel_right_behind() {
        let p = DraftParams::default();
        let leading = |gap| {
            p.group_factor(&GroupPlace {
                gap_behind: Some(gap),
                ..GroupPlace::default()
            })
        };
        assert!((leading(2.0) - 0.974).abs() < 1e-12);
        assert!((leading(3.0) - 0.987).abs() < 1e-12);
        assert_eq!(leading(4.0), 1.0);
    }

    #[test]
    fn in_the_middle_of_a_line_both_count() {
        let p = DraftParams::default();
        let middle = GroupPlace {
            gap_behind: Some(2.0),
            ..in_line(2.0, 1)
        };
        assert!((p.group_factor(&middle) - 0.7 * 0.974).abs() < 1e-12);
    }

    #[test]
    fn a_beer_bike_keeps_its_draft_deeper_in_the_line() {
        let p = DraftParams::default();
        let behind_a_beer_bike = GroupPlace {
            wheel: Some(Wheel {
                gap: 2.0,
                max_reduction: 0.5,
                depth: 2,
            }),
            ..GroupPlace::default()
        };
        assert!((p.group_factor(&behind_a_beer_bike) - 0.5).abs() < 1e-12);
    }

    #[test]
    fn lanes_match_within_tolerance() {
        let p = DraftParams::default();
        assert!(p.same_lane(1.0, 1.3));
        assert!(!p.same_lane(1.0, 1.6));
    }
}
