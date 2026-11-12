//! Prints the physics calibration table: `cargo run -p gowift-sim --example calibration`.

use gowift_sim::calibration::{markdown, table, RIDERS};
use gowift_sim::physics::PhysicsParams;

fn main() {
    print!("{}", markdown(&table(&PhysicsParams::default(), &RIDERS)));
}
