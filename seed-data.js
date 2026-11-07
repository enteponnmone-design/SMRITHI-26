// Base seed content for a fresh install: exactly one example of each record type.
// Everything here can be edited or deleted from the admin dashboard.
export const SEED = {
  teams: [{ id: "example_college", name: "Example College, Kottayam" }],
  events: [{ id: "football", name: "Football" }],
  days: [
    { id: "day_1", label: "Day 1 - 20 Mar", highlight: "Opening ceremony + football final", sort_order: 1 },
  ],
  fixtures: [
    {
      id: "fixture_1",
      day_id: "day_1",
      event_id: "football",
      event_name: "Football",
      team_one_id: "",
      team_one_name: "Example College A",
      team_two_id: "",
      team_two_name: "Example College B",
      round: "Final",
      time: "4:00 PM",
      status: "upcoming",
      winner: "",
      score: "",
      score_round: "",
      live_link: "",
      sort_order: 1,
    },
  ],
  results: [
    {
      id: "result_1",
      event_id: "football",
      name: "Football",
      first_team_id: "example_college",
      second_team_id: "",
      third_team_id: "",
    },
  ],
  sponsors: [
    {
      id: "sponsor_1",
      name: "Example Sponsor",
      logo_url: "/photo-placeholder.svg",
      link: "",
      sort_order: 1,
    },
  ],
  gallery: [
    {
      id: "gallery_1",
      url: "/photo-placeholder.svg",
      caption: "Example photo — replace from the dashboard",
      group_name: "SMRITHI 2026",
      sort_order: 1,
    },
  ],
};
