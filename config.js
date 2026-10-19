// ============================================================
//  Hypnovember yearly settings: the only file you need to edit
//  to set up a new year (plus dropping card PNGs in cards/).
// ============================================================
const HYPNOVEMBER = {
    year: 2026,

    // Google Form people use to submit
    submitForm: 'https://forms.gle/A9Pos4QKTHfwsQuU8',

    // Google Sheet with the submissions. The sheet must be shared as
    // "anyone with the link can view". `gid` is the number at the end
    // of the tab's URL (...edit#gid=123456). Leave gid as null until
    // the 2026 tab exists and the site will say "no entries yet".
    sheetId: '1gvU4YH6lKy1N8BE7RLRPIotoqyDikZ8x_28nuR3rGh0',
    gid: 1164754374,

    // Prompts and characters, in day order (day 1 first). Anything
    // missing shows as "TBD".
    prompts: [
        'Hypnotic Screen',
        'Maid',
        'Hypnotic Plant',
        'Roboticization/Robot TF',
        'Alien',
        'Embarrassment',
        'Hospital/Nurse',
        'Hacking',
        'Kissing',
        'Corrupting Fluids',
        'Secretary',
        'Brain Penetration',
        'Suit Takeover',
        'Feminization',
        'Conversion',
        'Remote Control',
        'Reflection',
        'Collar and Leash',
        'Gas',
        'Hypnogear',
        'Changelingification',
        'Brain Drain',
        'Body Control',
        'Sleeper Agent',
        'Cursed Armor',
        'Tech Control',
        'Contagious Brainwashing',
        'Villain',
        'Hypnotized Dom',
        'Corruption',
    ],
    characters: [
        'Lightning Dust',
        'Maud Pie',
        'Applejack',
        'Changelings',
        'Autumn Blaze',
        'Rainbow Dash',
        'Rarity',
        'Chrysalis',
        'Cadance',
        'Fluttershy/Flutterbat',
        'Moondancer',
        'Luna/Nightmare Moon',
        'Pinkie Pie',
        'Braeburn',
        'Starlight Glimmer',
        'Stellar Flare',
        'Sunset Shimmer',
        'Sombra',
        'Kirins',
        'Trixie Lulamoon',
        'Shining Armor',
        'Twilight Sparkle',
        'Eris',
        'Spitfire',
        'Royal Guards',
        'Thunderlane',
        'Sirens',
        'Ember',
        'Shadowbolts',
        'Celestia/Daybreaker',
    ],
    // Optional links for character names (e.g. OCs), keyed by name
    characterLinks: {
        // 'Starfall Shine': 'https://derpibooru.org/3525023',
    },

    // Past years, newest first: shown in the menu
    archives: [2025, 2024],
};
