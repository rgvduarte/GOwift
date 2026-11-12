//! Prints the physics calibration table: `cargo run -p goindoor-sim --example calibration`.

use goindoor_sim::calibration::{markdown, table, RIDERS};
use goindoor_sim::physics::PhysicsParams;

fn main() {
    print!("{}", markdown(&table(&PhysicsParams::default(), &RIDERS)));
}
