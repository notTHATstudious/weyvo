// Sample content used until the API exists. All people and stories are fictional.

export type Scene = 'mountain' | 'sea' | 'road' | 'city' | 'desert' | 'forest';
export type ShortTag = 'Weekend' | 'One night' | 'Long drive' | 'Day trip';

export interface Person {
  handle: string;
  name: string;
  initial: string;
  color: string;
  bio: string;
}

export interface StorySection {
  heading: string;
  body: string;
  photo?: { scene: Scene; caption: string };
}

export interface Trip {
  slug: string;
  kind: 'full';
  issue: string;
  title: string;
  place: string;
  days: string;
  when: string;
  scene: Scene;
  by: string;
  intro: string;
  sections: StorySection[];
  moments: string[];
  finalNote: string;
  been: number;
  want: number;
}

export interface ShortStory {
  id: string;
  kind: 'short';
  tag: ShortTag;
  title: string;
  place: string;
  by: string;
  when: string;
  been: number;
  want: number;
  photos: { scene: Scene; caption: string }[];
}

export interface Place {
  slug: string;
  name: string;
  country: string;
  scene: Scene;
  stories: number;
  shorts: number;
  wantToGo: number;
  monthly: number[];
}

export const people: Record<string, Person> = {
  aarav: { handle: 'aarav', name: 'Aarav Mehta', initial: 'A', color: '#7A4E3F', bio: 'Mountains, slow trains and bad selfies. Pune.' },
  lena: { handle: 'lena', name: 'Lena Fischer', initial: 'L', color: '#2F6573', bio: 'Ferries, night markets, one camera.' },
  sana: { handle: 'sana', name: 'Sana Qureshi', initial: 'S', color: '#8E9A5B', bio: 'Weekend road trips out of Mumbai.' },
  diego: { handle: 'diego', name: 'Diego Ramos', initial: 'D', color: '#2F6573', bio: 'Beaches I can reach by Friday night.' },
  mira: { handle: 'mira', name: 'Mira Patel', initial: 'M', color: '#6E8F6A', bio: 'Coffee estates and early mornings.' },
};

export const trips: Trip[] = [
  {
    slug: 'ten-days-above-the-clouds', kind: 'full', issue: 'Issue 07', title: 'Ten days above the clouds',
    place: 'Spiti Valley, India', days: '10 days', when: 'June 2026', scene: 'mountain', by: 'aarav',
    intro: 'We went for the monasteries and stayed for the silence. No signal for six days, one broken axle, and the clearest night sky I have ever seen.',
    sections: [
      { heading: 'The road in', body: 'From Manali the road turns to gravel within an hour. By Kunzum Pass the snow walls were taller than the car, and our driver Tenzin was humming the same song for the third time.',
        photo: { scene: 'desert', caption: 'Chandratal at 4,300 m. We camped a kilometre away and walked in at dawn.' } },
      { heading: 'Key Monastery', body: 'A monk named Lobsang made us butter tea and showed us the room where they keep the oldest manuscripts. He asked where we were from and then, very seriously, whether Mumbai has mountains.' },
      { heading: 'The axle', body: 'On day six the axle went near Losar. We waited four hours and a truck full of apples towed us into the village.',
        photo: { scene: 'city', caption: 'The night sky over Kaza. A 20-second exposure on a phone.' } },
    ],
    moments: ['Butter tea with Lobsang at Key', 'The apple truck that rescued us', 'Dawn at Chandratal, alone'],
    finalNote: 'Go before the road gets paved.',
    been: 41, want: 213,
  },
  {
    slug: 'ferries-tea-and-the-bosphorus', kind: 'full', issue: 'Issue 12', title: 'Ferries, tea and the Bosphorus at night',
    place: 'Istanbul, Türkiye', days: '6 days', when: 'May 2026', scene: 'city', by: 'lena',
    intro: 'Six days, forty ferry rides and more tea than water. Istanbul is best seen from the deck of a boat.',
    sections: [
      { heading: 'Kadıköy mornings', body: 'Every day began on the Asian side with simit and a ferry across. The commute is the sightseeing.' },
      { heading: 'The bazaar', body: 'We got lost in the Grand Bazaar on purpose and found a lamp seller who has been in the same stall for 41 years.',
        photo: { scene: 'desert', caption: 'Spice stalls near the Egyptian Bazaar.' } },
    ],
    moments: ['Sunset ferry to Üsküdar', 'Midnight balık ekmek', 'The lamp seller'],
    finalNote: 'Buy an Istanbulkart on day one.',
    been: 88, want: 156,
  },
  {
    slug: 'coffee-mist-and-a-borrowed-scooter', kind: 'full', issue: 'Issue 03', title: 'Coffee, mist and a borrowed scooter',
    place: 'Coorg, Karnataka', days: '4 days', when: 'July 2026', scene: 'forest', by: 'mira',
    intro: 'Monsoon in the coffee hills. Everything was green, wet and smelled like breakfast.',
    sections: [{ heading: 'The estate', body: 'Our homestay owner walked us through the estate at 6 am, explaining which plants were arabica and which were robusta.' }],
    moments: ['Fresh filter coffee at 6 am', 'Abbey Falls in full flow', 'The borrowed scooter'],
    finalNote: 'Carry a raincoat, not an umbrella.',
    been: 35, want: 190,
  },
  {
    slug: 'the-beach-we-had-to-ourselves', kind: 'full', issue: 'Issue 05', title: 'The beach we had to ourselves',
    place: 'Gokarna, Karnataka', days: '3 days', when: 'August 2026', scene: 'sea', by: 'diego',
    intro: 'Off-season Gokarna is a different place. Empty beaches, closed shacks and the best sunsets.',
    sections: [{ heading: 'Half Moon Beach', body: 'A 40-minute walk over the rocks and we had the whole beach to ourselves for an afternoon.' }],
    moments: ['The rock walk', 'Fish thali at a family kitchen', 'Sunset at Om Beach'],
    finalNote: 'Go in September, just after the rains.',
    been: 62, want: 240,
  },
];

export const shorts: ShortStory[] = [
  { id: 's1', kind: 'short', tag: 'Long drive', title: 'Windows down, chai at every bend', place: 'Mumbai → Lonavala', by: 'sana', when: 'Sunday', been: 312, want: 870,
    photos: [{ scene: 'road', caption: 'Left at 5 am to beat the traffic. Worth it for this light.' }, { scene: 'forest', caption: 'Stopped for vada pav and the fog rolled right in.' }, { scene: 'mountain', caption: 'Tiger Point at noon. Back home by dinner.' }] },
  { id: 's2', kind: 'short', tag: 'One night', title: 'One bonfire, zero plans', place: 'Alibaug, Maharashtra', by: 'diego', when: 'Last weekend', been: 140, want: 402,
    photos: [{ scene: 'sea', caption: 'Took the ferry from Gateway. 45 minutes and you are somewhere else.' }, { scene: 'desert', caption: 'The beach shack let us stay till the stars came out.' }] },
  { id: 's3', kind: 'short', tag: 'Weekend', title: 'The pink city after dark', place: 'Jaipur, Rajasthan', by: 'lena', when: '3 days ago', been: 520, want: 1204,
    photos: [{ scene: 'city', caption: 'Hawa Mahal lit up, almost empty at 10 pm.' }, { scene: 'desert', caption: 'Nahargarh at sunset. Bring a jacket.' }] },
  { id: 's4', kind: 'short', tag: 'Weekend', title: 'Dunes at 6 am', place: 'Pushkar, Rajasthan', by: 'mira', when: '2 weeks ago', been: 98, want: 310,
    photos: [{ scene: 'desert', caption: 'Camel herders were already out before sunrise.' }] },
  { id: 's5', kind: 'short', tag: 'One night', title: 'A treehouse and the rain', place: 'Wayanad, Kerala', by: 'aarav', when: '1 week ago', been: 76, want: 455,
    photos: [{ scene: 'forest', caption: 'Rain on a tin roof, all night. Best sleep in months.' }] },
  { id: 's6', kind: 'short', tag: 'Day trip', title: 'Rajmachi, slow mornings', place: 'Rajmachi, Maharashtra', by: 'aarav', when: '3 weeks ago', been: 54, want: 128,
    photos: [{ scene: 'mountain', caption: 'Fort walls in the clouds by 8 am.' }] },
];

export const places: Place[] = [
  { slug: 'kyoto', name: 'Kyoto', country: 'Japan', scene: 'city', stories: 128, shorts: 46, wantToGo: 1940, monthly: [10, 22, 48, 100, 40, 12, 8, 10, 26, 58, 92, 30] },
  { slug: 'goa', name: 'Goa', country: 'India', scene: 'sea', stories: 342, shorts: 210, wantToGo: 4120, monthly: [90, 80, 60, 30, 15, 10, 12, 14, 20, 50, 85, 100] },
  { slug: 'spiti-valley', name: 'Spiti Valley', country: 'India', scene: 'mountain', stories: 96, shorts: 18, wantToGo: 2210, monthly: [2, 2, 4, 10, 40, 100, 90, 80, 60, 20, 4, 2] },
  { slug: 'jaisalmer', name: 'Jaisalmer', country: 'India', scene: 'desert', stories: 74, shorts: 33, wantToGo: 980, monthly: [100, 85, 50, 20, 8, 5, 5, 6, 15, 50, 90, 98] },
  { slug: 'coorg', name: 'Coorg', country: 'India', scene: 'forest', stories: 61, shorts: 52, wantToGo: 760, monthly: [50, 45, 40, 30, 25, 40, 70, 80, 60, 70, 80, 60] },
];

export const questions = [
  { place: 'kyoto', q: 'Is the JR pass worth it for Kyoto only?', by: 'Lena', a: 'No. Buy an ICOCA card and use buses and the subway.' },
  { place: 'kyoto', q: 'Best time to see the temples without crowds?', by: 'Diego', a: 'Before 8 am. Fushimi Inari is almost empty at 6.' },
];

export const mapPins = {
  been: [
    { name: 'Spiti', x: 58, y: 30 }, { name: 'Lisbon', x: 12, y: 30 }, { name: 'Istanbul', x: 47, y: 24 },
    { name: 'Bali', x: 80, y: 62 }, { name: 'Munnar', x: 62, y: 46 }, { name: 'Paris', x: 18, y: 22 }, { name: 'Hanoi', x: 76, y: 40 },
  ],
  want: [
    { name: 'Kyoto', x: 86, y: 26 }, { name: 'Cape Town', x: 52, y: 76 }, { name: 'Patagonia', x: 30, y: 86 },
    { name: 'Reykjavik', x: 24, y: 10 }, { name: 'Petra', x: 52, y: 36 }, { name: 'Banff', x: 14, y: 18 }, { name: 'Bhutan', x: 64, y: 32 },
  ],
};

export const tripBySlug = (slug?: string) => trips.find((t) => t.slug === slug);
export const placeBySlug = (slug?: string) => places.find((p) => p.slug === slug);
