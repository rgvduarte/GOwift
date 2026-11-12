//! Drafting (riding in someone's slipstream).
//!
//! A rider up to `max_gap` metres behind another rider in the same lane gets a
//! reduced drag area. Gaps are measured middle to middle, so `min_gap` is about
//! a bike length: the closest a rider gets (see [`crate::spacing`]). The
//! reduction is largest from there on in and fades linearly to zero at `max_gap`.
//!
//! In a group the shelter grows (ADR 0025): deeper in a line of wheels, and
//! with riders just ahead in the lanes alongside, up to a cap for a bunch.
//! Both fade like the draft itself, so no rider's drag jumps when someone
//! further up the line or alongside drifts a centimetre. The
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
    /// Reduction a rider in a neighbouring lane (at most `side_lanes` lanes
    /// off) adds for a rider on a wheel: all of it `min_gap` ahead, fading to
    /// nothing level with the rider and `side_gap` ahead.
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

/// A wheel of a line: the next rider ahead in a lane, close enough to draft.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Wheel {
    /// Metres to it from the rider (or wheel) right behind it, middle to middle.
    pub gap: f64,
    /// The reduction it gives the rider right behind it (its own
    /// [`DraftParams::max_reduction`]: more behind a beer bike).
    pub max_reduction: f64,
}

/// A rider's place in a group, as the draft sees it.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct GroupPlace {
    /// The line ahead in the rider's lane, nearest first: the wheel the rider
    /// follows, the wheel that one follows, and so on to the front. Empty
    /// without a wheel.
    pub line: Vec<Wheel>,
    /// Metres to each rider up to `side_gap` ahead in the lanes alongside.
    pub alongside: Vec<f64>,
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
        let follow = place.line.first().map_or(1.0, |wheel| {
            let line = self.line_reduction(&place.line);
            let side: f64 = place.alongside.iter().map(|&gap| self.side_share(gap)).sum();
            let flanked = line + self.side_per_rider * side;
            self.follow(wheel.gap, flanked.min(self.max_bunch.max(line)))
        });
        let lead = place.gap_behind.map_or(1.0, |gap| {
            let t = ((gap - self.min_gap) / (self.leader_gap - self.min_gap)).clamp(0.0, 1.0);
            1.0 - self.leader * (1.0 - t)
        });
        follow * lead
    }

    /// The most a rider at the back of `line` saves right behind its wheel.
    /// Each wheel further up raises it to that depth's reduction, or to what
    /// that wheel gives the rider right behind it if more (a beer bike's holds
    /// all the way down its line), but only as far as every link up to that
    /// wheel is close: all of it from `min_gap` in, nothing at `max_gap`.
    fn line_reduction(&self, line: &[Wheel]) -> f64 {
        let (mut level, mut reduction, mut reach) = (0.0_f64, 0.0, 1.0);
        for (k, wheel) in line.iter().enumerate() {
            let deeper = match k.checked_sub(1) {
                None => 0.0,
                Some(d) => {
                    reach *= self.closeness(wheel.gap);
                    self.deeper_wheels[d.min(self.deeper_wheels.len() - 1)]
                }
            };
            let next = level.max(deeper).max(wheel.max_reduction);
            reduction += (next - level) * reach;
            level = next;
        }
        reduction
    }

    /// How much of `side_per_rider` a rider `gap` metres ahead in a lane
    /// alongside gives: all of it `min_gap` (a bike length) ahead, nothing
    /// level with the rider or `side_gap` ahead, linear in between.
    fn side_share(&self, gap: f64) -> f64 {
        let rising = gap / self.min_gap.max(1e-9);
        let falling = (self.side_gap - gap) / (self.side_gap - self.min_gap).max(1e-9);
        rising.min(falling).clamp(0.0, 1.0)
    }

    /// CdA multiplier `gap` metres behind a wheel that gives `reduction` at its
    /// closest, fading out linearly across the window.
    fn follow(&self, gap: f64, reduction: f64) -> f64 {
        1.0 - reduction * self.closeness(gap)
    }

    /// How close `gap` is inside the draft window: 1 from `min_gap` in,
    /// falling linearly to 0 at `max_gap`, and 0 outside the window.
    fn closeness(&self, gap: f64) -> f64 {
        if gap <= 0.0 || gap > self.max_gap {
            return 0.0;
        }
        1.0 - (gap.max(self.min_gap) - self.min_gap) / (self.max_gap - self.min_gap)
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

    /// A wheel `gap` metres ahead that gives `max_reduction` right behind it.
    fn wheel(gap: f64, max_reduction: f64) -> Wheel {
        Wheel { gap, max_reduction }
    }

    /// A rider `gap` metres behind a normal rider, `depth` wheels deep in a
    /// line of normal riders 2 m apart.
    fn in_line(gap: f64, depth: usize) -> GroupPlace {
        let normal = DraftParams::default().max_reduction;
        GroupPlace {
            line: std::iter::once(wheel(gap, normal))
                .chain(std::iter::repeat_n(wheel(2.0, normal), depth - 1))
                .collect(),
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

    #[test]
    fn a_deeper_wheel_adds_as_much_as_the_link_ahead_is_close() {
        // Halfway through the window, the second wheel's extra 10 % is half there.
        let p = DraftParams::default();
        let loose = GroupPlace {
            line: vec![wheel(2.0, 0.3), wheel(4.25, 0.3)],
            ..GroupPlace::default()
        };
        assert!((p.group_factor(&loose) - 0.65).abs() < 1e-12);
    }

    #[test]
    fn a_link_ahead_at_the_end_of_the_window_adds_no_depth() {
        let p = DraftParams::default();
        let open = GroupPlace {
            line: vec![wheel(2.0, 0.3), wheel(6.5, 0.3)],
            ..GroupPlace::default()
        };
        assert!((p.group_factor(&open) - p.cda_factor(2.0)).abs() < 1e-12);
    }

    /// The draft 2 m behind the fourth wheel of a line with riders in the
    /// lanes next to it at `alongside` metres ahead.
    fn flanked(alongside: &[f64]) -> f64 {
        DraftParams::default().group_factor(&GroupPlace {
            alongside: alongside.to_vec(),
            ..in_line(2.0, 4)
        })
    }

    #[test]
    fn a_rider_alongside_a_bike_length_ahead_adds_its_full_share() {
        assert!((flanked(&[2.0]) - (1.0 - 0.48 - 0.04)).abs() < 1e-12);
    }

    #[test]
    fn a_rider_alongside_adds_less_on_its_way_out_to_the_side_gap() {
        assert!((flanked(&[3.0]) - (1.0 - 0.48 - 0.02)).abs() < 1e-12);
    }

    #[test]
    fn a_rider_alongside_adds_less_as_it_draws_level() {
        assert!((flanked(&[1.0]) - (1.0 - 0.48 - 0.02)).abs() < 1e-12);
    }

    #[test]
    fn riders_alongside_add_no_more_than_the_bunch_cap() {
        assert!((flanked(&[2.0; 10]) - (1.0 - DraftParams::default().max_bunch)).abs() < 1e-12);
    }

    #[test]
    fn riders_alongside_shelter_nobody_without_a_wheel() {
        let p = DraftParams::default();
        let alone = GroupPlace {
            alongside: vec![2.0; 3],
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

    /// The draft 2 m behind the first wheel of `line`, all of it 2 m apart,
    /// with each wheel's own reduction given nearest first.
    fn behind(line: &[f64]) -> f64 {
        DraftParams::default().group_factor(&GroupPlace {
            line: line.iter().map(|&max_reduction| wheel(2.0, max_reduction)).collect(),
            ..GroupPlace::default()
        })
    }

    #[test]
    fn a_beer_bike_keeps_its_draft_when_it_follows_a_wheel() {
        assert!((behind(&[0.5, 0.3]) - 0.5).abs() < 1e-12);
    }

    #[test]
    fn the_second_wheel_behind_a_beer_bike_keeps_its_draft() {
        assert!((behind(&[0.3, 0.5]) - 0.5).abs() < 1e-12);
    }

    #[test]
    fn a_beer_bike_keeps_its_draft_on_every_wheel_of_its_line() {
        assert!((behind(&[0.3, 0.3, 0.3, 0.3, 0.3, 0.5]) - 0.5).abs() < 1e-12);
    }

    #[test]
    fn a_beer_bike_s_draft_down_the_line_fades_with_the_links_to_it() {
        // The link to it halfway through the window: 30 % plus half of the
        // 20 % more it gives.
        let p = DraftParams::default();
        let loose = GroupPlace {
            line: vec![wheel(2.0, 0.3), wheel(4.25, 0.5)],
            ..GroupPlace::default()
        };
        assert!((p.group_factor(&loose) - 0.6).abs() < 1e-12);
    }

    #[test]
    fn lanes_match_within_tolerance() {
        let p = DraftParams::default();
        assert!(p.same_lane(1.0, 1.3));
        assert!(!p.same_lane(1.0, 1.6));
    }
}
