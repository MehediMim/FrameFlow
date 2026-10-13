// FrameFlow Paper Studio: ready-made newspaper templates. Everything is editable after loading.
import { newPaperProject, makePart, makeShot } from './paper-engine.mjs';

const P = (kind, over = {}) => makePart(kind, over.start ?? 0, over);
const S = (type, start, over = {}) => makeShot(type, start, over);

const EN_BODY = [
  'The long-awaited crossing opened to traffic at first light on Tuesday, ending more than a decade of delays, budget disputes and detours. Crowds began gathering on both banks well before sunrise, many carrying flags and cameras to watch the first vehicles roll across the span.',
  'Project officials said the bridge is expected to cut travel times between the two districts by more than forty minutes during rush hour, easing pressure on the overcrowded ferry terminals and the aging highway to the north.',
  '"I have waited my whole life for this," said one shopkeeper who has crossed the river by boat every morning for thirty years. "Today my children will go to school by road."',
  'Engineers added that a dedicated walkway and cycle lane run along both sides of the structure, with lighting designed to illuminate the river after dark. Heavy freight will be allowed from next week once the final load tests are complete.',
  'Transport authorities urged drivers to be patient during the opening days and to follow temporary speed limits while the new traffic management system is calibrated. A full public inspection report will be published later this month.',
  'Local traders said they expect footfall in the eastern markets to rise sharply now that customers no longer need to travel the long way around. Several shops have already extended their opening hours for the first week.',
  'City planners described the bridge as the first phase of a wider plan to connect the riverside districts, with a rail link and two new bus corridors due to be announced after the budget session.',
  'For many families the day was about more than traffic. Children waved from the walkway, street vendors sold tea and sweets, and a brass band played as the ribbon was cut by the oldest resident of the village on the far bank.',
  'The structure was designed to withstand floods and strong winds, and sensors embedded along the deck will monitor movement and load around the clock. Engineers said the data will be shared with the public online.',
].join('\n');

const BN_BODY = [
  'রাজধানীর প্রান্তে নির্মিত নতুন সেতুটি আজ সকালে যান চলাচলের জন্য খুলে দেওয়া হয়েছে। সূর্য ওঠার আগে থেকেই নদীর দুই পাড়ে হাজার হাজার মানুষ জড়ো হন। উদ্বোধনের পর প্রথম গাড়িটি সেতু পার হতেই করতালিতে মুখর হয়ে ওঠে চারপাশ।',
  'প্রকল্প কর্মকর্তারা জানান, এই সেতু চালু হওয়ায় প্রতিদিন লাখো মানুষের যাতায়াতের সময় অনেকটাই কমে আসবে। পণ্য পরিবহনেও খরচ কমবে বলে আশা করা হচ্ছে।',
  'স্থানীয় ব্যবসায়ীরা বলছেন, দীর্ঘদিন ধরে নদী পারাপারে তাঁদের ভোগান্তি পোহাতে হয়েছে। এখন থেকে সেই দুর্ভোগ অনেকটাই লাঘব হবে।',
  'সেতুর দুই পাশে পথচারীদের জন্য আলাদা পথ এবং আলোকসজ্জার ব্যবস্থা রাখা হয়েছে। আগামী সপ্তাহ থেকে ভারী যানবাহনও চলাচল করতে পারবে বলে জানিয়েছেন কর্তৃপক্ষ।',
  'যান চলাচলের প্রথম কয়েক দিন চালকদের ধৈর্য ধরার এবং নির্ধারিত গতিসীমা মেনে চলার অনুরোধ জানিয়েছে সড়ক কর্তৃপক্ষ।',
  'পূর্বাঞ্চলের বাজারগুলোতে ক্রেতার সংখ্যা বাড়বে বলে আশা করছেন স্থানীয় দোকানিরা। প্রথম সপ্তাহে অনেক দোকান খোলা রাখার সময়ও বাড়িয়েছে।',
  'নগর পরিকল্পনাবিদরা বলছেন, নদীর দুই পাড়ের এলাকাগুলোকে যুক্ত করার বড় পরিকল্পনার প্রথম ধাপ এই সেতু। আগামী বাজেট অধিবেশনের পর রেল সংযোগ ও নতুন বাস লেনের ঘোষণা আসতে পারে।',
  'অনেক পরিবারের কাছে দিনটি ছিল উৎসবের মতো। সেতুর ওপর শিশুরা হাত নেড়েছে, পথের ধারে চা-মিষ্টি বিক্রি হয়েছে, আর ফিতা কেটেছেন ওপারের গ্রামের সবচেয়ে প্রবীণ বাসিন্দা।',
  'বন্যা ও ঝড়ো হাওয়া সহ্য করার মতো করে সেতুটি নকশা করা হয়েছে। সেতুর পাটাতনে বসানো সেন্সর দিনরাত চাপ ও নড়াচড়া পর্যবেক্ষণ করবে বলে জানিয়েছেন প্রকৌশলীরা।',
].join('\n');

function frontPage(c) {
  const mast = P('masthead', { name: 'Masthead', x: 50, y: 40, w: 1100, h: 150, text: c.mast, font: c.mastFont, weight: c.mastWeight, size: c.mastSize, metaL: c.metaL, metaC: c.metaC, metaR: c.metaR, metaFont: c.bodyFont, start: 44, dur: 22, anim: 'wipe' });
  const head = P('headline', { name: 'Main headline', x: 50, y: 210, w: 1100, h: 240, text: c.head, font: c.headFont, weight: 800, size: 130, caps: c.caps, lineH: c.headLH, start: 68, dur: 30, anim: 'words' });
  const sub = P('text', { name: 'Subheading', x: 50, y: 462, w: 1100, h: 70, text: c.sub, font: c.subFont, weight: 400, italic: c.subItalic, size: 30, autoFit: true, lineH: 1.3, valign: 'middle', start: 96, dur: 18, anim: 'fade' });
  const rule = P('rule', { name: 'Divider', x: 50, y: 546, w: 1100, h: 12, style: 'double', start: 100, dur: 16 });
  const photo = P('photo', { name: 'Main photo', x: 50, y: 572, w: 720, h: 450, placeholder: 'bridge', treat: 'halftone', caption: c.cap, capFont: c.bodyFont, start: 104, dur: 24, anim: 'wipe' });
  const side = P('text', { name: 'Sidebar box', x: 800, y: 572, w: 350, h: 450, text: c.side, font: c.bodyFont, size: c.sideSize, lineH: c.sideLH, pad: 18, border: 2, start: 120, dur: 24, anim: 'lines' });
  const stamp = P('stamp', { name: 'Stamp', x: 560, y: 610, w: 250, h: 76, text: c.stamp, font: c.stampFont, weight: c.stampWeight, size: 56, rot: -8, start: 150, dur: 10 });
  const cols = P('columns', { name: 'Article columns', x: 50, y: 1052, w: 1100, h: 508, text: c.body, font: c.bodyFont, size: c.bodySize, cols: c.cols, lineH: c.bodyLH, dropCap: c.dropCap, start: 130, dur: 46 });
  const mark = P('marker', { name: 'Highlighter', target: sub.id, style: 'highlight', color: '#ffe14a', start: 108, dur: 24 });
  return {
    name: c.name, frames: 270, camera: { x: 600, y: 330, zoom: .95, rot: 0 }, scene: { type: 'wood', color: '#2a2f36' },
    paper: { w: 1200, h: 1600, stock: 'newsprint', edge: 'clean', fold: 'half', wear: .3, enter: 'spin', start: 0, dur: 42, easing: 'easeOut' },
    parts: [cols, side, photo, rule, sub, head, mast, mark, stamp],
    shots: [S('focus', 74, { name: 'Focus: headline', target: head.id, dur: 36, fill: .92 }), S('focus', 128, { name: 'Focus: photo', target: photo.id, dur: 40, fill: .85 }),
      S('shake', 150, { amp: 8, dur: 10 }), S('focus', 186, { name: 'Focus: article', target: cols.id, dur: 36, fill: .9 }), S('showAll', 236, { dur: 34 })],
  };
}

const TEMPLATES = {
  front: {
    label: 'Front page', icon: '▤', peek: 262, hint: 'Classic broadsheet: masthead, headline, photo, sidebar and columns',
    build: () => frontPage({ name: 'Front page', mast: 'THE DAILY CHRONICLE', mastFont: 'UnifrakturCook', mastWeight: 700, mastSize: 100, metaL: 'VOL. CXXIV · NO. 312', metaC: 'TUESDAY, OCTOBER 13, 2026', metaR: 'PRICE: 2 TAKA',
      head: 'HISTORIC BRIDGE OPENS AFTER 12 YEARS', headFont: 'Playfair Display', caps: true, headLH: 1.02, sub: 'Thousands line the riverbank as the first cars cross at dawn; officials promise shorter commutes for millions.', subFont: 'Playfair Display', subItalic: true,
      cap: 'The new bridge at sunrise, hours before the opening ceremony. Photo: Staff', side: 'INSIDE\n\nBUSINESS\nBudget talks resume as markets rally\n\nSPORT\nNational side reaches the final\n\nOPINION\nWhy our cities need better transit\n\nCULTURE\nFestival returns to the riverfront',
      sideSize: 21, sideLH: 1.3, stamp: 'EXCLUSIVE', stampFont: 'Anton', stampWeight: 400, body: EN_BODY, bodyFont: 'Source Serif 4', bodySize: 17, cols: 4, bodyLH: 1.38, dropCap: true }),
  },
  breaking: {
    label: 'Breaking news', icon: '⚡', peek: 200, hint: 'Slap-on-the-table tabloid with a flashing banner, slam headline and ticker',
    build() {
      const mast = P('masthead', { name: 'Masthead', x: 40, y: 30, w: 920, h: 120, text: 'THE DAILY BLAZE', font: 'Anton', weight: 400, size: 90, color: '#d90429', metaL: '', metaC: 'LATE NIGHT EXTRA', metaR: '', metaFont: 'Oswald', start: 10, dur: 14, anim: 'slideDown' });
      const ban = P('banner', { name: 'Breaking banner', x: 0, y: 170, w: 1000, h: 120, text: 'BREAKING NEWS', start: 18, dur: 16 });
      const head = P('headline', { name: 'Main headline', x: 40, y: 320, w: 920, h: 300, text: 'CITY ON LOCKDOWN AS STORM HITS COAST', font: 'Anton', weight: 400, size: 150, lineH: .98, start: 36, dur: 14, anim: 'slam' });
      const photo = P('photo', { name: 'Main photo', x: 40, y: 650, w: 920, h: 390, placeholder: 'city', treat: 'bw', caption: 'Emergency crews respond across the city as the storm intensifies. Photo: Staff', capFont: 'Libre Baskerville', start: 52, dur: 20 });
      const stamp = P('stamp', { name: 'LIVE stamp', x: 730, y: 670, w: 200, h: 80, text: 'LIVE', rot: 6, start: 74, dur: 10 });
      const sub = P('text', { name: 'Subheading', x: 40, y: 1060, w: 920, h: 80, text: 'Emergency services warn residents to stay indoors as winds reach 120 km/h.', font: 'Oswald', weight: 600, size: 34, autoFit: true, lineH: 1.2, valign: 'middle', start: 80, dur: 16 });
      const cols = P('columns', { name: 'Article columns', x: 40, y: 1155, w: 920, h: 175, text: 'Emergency services have urged residents along the coast to remain indoors as the storm continues to intensify. Authorities said power outages are widespread and several major roads have been closed.\nMeteorologists expect conditions to worsen overnight, with gusts exceeding 120 km/h forecast for exposed areas. Shelters have been opened in schools and community halls across the region.', font: 'Source Serif 4', size: 15, lineH: 1.38, cols: 2, dropCap: false, start: 96, dur: 36 });
      const tick = P('ticker', { name: 'News ticker', x: 0, y: 1340, w: 1000, h: 60, text: 'Winds reach 120 km/h  •  Schools closed across the region  •  Flights cancelled  •  Stay indoors and follow official advice', size: 28, start: 70, dur: 14 });
      const mark = P('marker', { name: 'Red underline', target: sub.id, style: 'underline', color: '#d90429', start: 112, dur: 20 });
      return { name: 'Breaking news', frames: 210, camera: { x: 500, y: 340, zoom: 1, rot: 0 }, scene: { type: 'dark', color: '#2a2f36' },
        paper: { w: 1000, h: 1400, stock: 'white', edge: 'clean', fold: 'half', wear: .08, enter: 'slap', start: 0, dur: 10, easing: 'easeOut' },
        parts: [cols, sub, photo, head, ban, mast, mark, stamp, tick],
        shots: [S('shake', 8, { amp: 16, dur: 14 }), S('focus', 40, { name: 'Focus: headline', target: head.id, dur: 30, fill: .95 }), S('focus', 90, { name: 'Focus: photo', target: photo.id, dur: 30, fill: .9 }), S('shake', 74, { amp: 8, dur: 10 }), S('focus', 130, { name: 'Focus: ticker', target: tick.id, dur: 30, fill: .95 }), S('showAll', 172, { dur: 30 })] };
    },
  },
  headline: {
    label: 'Headline close-up', icon: 'H', peek: 120, hint: 'Full-frame newsprint where a headline types itself and gets underlined',
    build() {
      const cols = P('columns', { name: 'Faint article text', x: 40, y: 150, w: 1200, h: 530, text: EN_BODY + '\n' + EN_BODY, font: 'Source Serif 4', size: 15, lineH: 1.4, cols: 6, mode: 'lines', opacity: .5, dropCap: false, start: 0, dur: 40 });
      const mast = P('masthead', { name: 'Masthead', x: 40, y: 26, w: 1200, h: 104, text: 'THE MORNING POST', font: 'Playfair Display', weight: 800, size: 74, metaL: 'EST. 1894', metaC: 'LATE EDITION', metaR: 'TUESDAY', metaFont: 'Libre Baskerville', start: 6, dur: 18 });
      const head = P('headline', { name: 'Headline', x: 110, y: 190, w: 1060, h: 320, text: 'SCIENTISTS DISCOVER NEW SPECIES IN DEEP OCEAN', font: 'Playfair Display', weight: 800, size: 140, align: 'center', valign: 'middle', bg: '#e6dfcb', pad: 28, border: 4, anim: 'type', easing: 'linear', start: 24, dur: 60 });
      const by = P('text', { name: 'Byline', x: 110, y: 530, w: 1060, h: 40, text: 'By STAFF REPORTER  ·  Updated 6 minutes ago', font: 'Special Elite', size: 24, color: '#5a554c', align: 'center', start: 90, dur: 14 });
      const mark = P('marker', { name: 'Red underline', target: head.id, style: 'underline', color: '#d90429', width: 7, start: 96, dur: 40 });
      return { name: 'Headline close-up', frames: 180, camera: { x: 640, y: 360, zoom: 1, rot: 0 }, scene: { type: 'dark', color: '#2a2f36' },
        paper: { w: 1280, h: 720, stock: 'newsprint', edge: 'clean', fold: 'none', wear: .35, shadow: false, enter: 'zoom', start: 0, dur: 14, easing: 'easeOut' },
        parts: [cols, mast, head, by, mark], shots: [S('push', 0, { name: 'Slow push-in', target: head.id, amount: .14, dur: 170 })] };
    },
  },
  extra: {
    label: 'Vintage extra', icon: '✦', peek: 232, hint: 'Aged, torn newsprint spins in with an EXTRA! banner and sepia photo',
    build() {
      const ink = '#2b2114';
      const ban = P('banner', { name: 'EXTRA banner', x: 40, y: 44, w: 920, h: 140, text: 'EXTRA!  EXTRA!', font: 'Rozha One', size: 110, bg: '#1a1410', color: '#e8d9b0', shape: 'rect', stripes: false, flash: false, start: 46, dur: 14, anim: 'pop' });
      const mast = P('masthead', { name: 'Masthead', x: 40, y: 200, w: 920, h: 130, text: 'THE EVENING STAR', font: 'UnifrakturCook', size: 90, color: ink, metaL: 'LATE EDITION', metaC: 'CITY FINAL', metaR: 'FIVE CENTS', metaFont: 'Old Standard TT', start: 58, dur: 18 });
      const head = P('headline', { name: 'Main headline', x: 40, y: 350, w: 920, h: 260, text: 'MYSTERY AIRSHIP SIGHTED OVER THE CITY!', font: 'Old Standard TT', weight: 700, size: 120, align: 'center', lineH: 1, color: ink, start: 76, dur: 28, anim: 'slam' });
      const sub = P('text', { name: 'Subheading', x: 40, y: 622, w: 920, h: 70, text: 'Thousands witness strange lights in the evening sky; police baffled, mayor promises inquiry', font: 'Old Standard TT', italic: true, size: 28, align: 'center', autoFit: true, valign: 'middle', color: ink, start: 100, dur: 18 });
      const rule = P('rule', { name: 'Divider', x: 40, y: 706, w: 920, h: 12, color: ink, start: 104, dur: 16 });
      const photo = P('photo', { name: 'Main photo', x: 40, y: 730, w: 560, h: 380, placeholder: 'city', treat: 'sepia', caption: 'Crowds gather on the rooftops for a glimpse of the strange visitor. Photo: Staff', capFont: 'Old Standard TT', color: ink, borderColor: ink, start: 110, dur: 22 });
      const col1 = P('columns', { name: 'Article column', x: 630, y: 730, w: 330, h: 380, text: 'Hundreds of residents reported strange lights moving silently over the rooftops shortly after dusk on Monday evening. Police received more than three hundred calls within the hour.\nA local watchmaker, who observed the object through a telescope, described it as long as a ferry, shaped like a cigar, and quiet as a cat. The mayor has promised a full inquiry.\nWitnesses on the east side said the lights circled twice before drifting out over the harbor.', font: 'Old Standard TT', size: 17, lineH: 1.4, cols: 1, color: ink, start: 124, dur: 40 });
      const col2 = P('columns', { name: 'Lower columns', x: 40, y: 1135, w: 920, h: 225, text: EN_BODY, font: 'Old Standard TT', size: 15, lineH: 1.4, cols: 3, dropCap: false, color: ink, start: 140, dur: 40 });
      const stamp = P('stamp', { name: 'Stamp', x: 600, y: 1140, w: 340, h: 90, text: 'LATE EDITION', font: 'Rozha One', size: 60, color: '#7a1313', rot: -10, start: 180, dur: 10 });
      return { name: 'Vintage extra', frames: 240, camera: { x: 500, y: 340, zoom: .95, rot: 0 }, scene: { type: 'wood', color: '#2a2f36' },
        paper: { w: 1000, h: 1400, stock: 'aged', edge: 'torn', fold: 'quarter', wear: .75, enter: 'spin', start: 0, dur: 44, easing: 'easeOut' },
        parts: [col2, col1, photo, rule, sub, head, mast, ban, stamp],
        shots: [S('focus', 80, { name: 'Focus: headline', target: head.id, dur: 36, fill: .92 }), S('focus', 140, { name: 'Focus: photo', target: photo.id, dur: 36, fill: .85 }), S('shake', 180, { amp: 8, dur: 10 }), S('showAll', 196, { dur: 36 })] };
    },
  },
  clipping: {
    label: 'Clipping on cork', icon: '✂', peek: 214, hint: 'A torn clipping drops onto a corkboard, gets taped, highlighted and circled',
    build() {
      const head = P('headline', { name: 'Headline', x: 34, y: 30, w: 652, h: 120, text: 'LOCAL BAKERY WINS NATIONAL AWARD', font: 'Playfair Display', weight: 800, size: 62, lineH: 1, start: 30, dur: 24 });
      const by = P('text', { name: 'Byline', x: 34, y: 158, w: 652, h: 28, text: 'By Staff Reporter  ·  Tuesday', font: 'Libre Baskerville', italic: true, size: 15, start: 52, dur: 12 });
      const rule = P('rule', { name: 'Divider', x: 34, y: 192, w: 652, h: 8, style: 'single', thickness: 2, start: 54, dur: 14 });
      const cols = P('columns', { name: 'Article columns', x: 34, y: 210, w: 430, h: 262, text: 'The family-run bakery, open since 1962, beat hundreds of entries to take the top prize for its signature sourdough. The owners say the secret is patience and a starter older than the shop itself.\nCustomers queued around the block on Saturday morning to congratulate the team. By noon, every loaf had sold out.\nJudges praised the crust, the crumb and the bakery\'s commitment to local flour.', font: 'Source Serif 4', size: 14, lineH: 1.4, cols: 2, gap: 20, start: 56, dur: 40 });
      const photo = P('photo', { name: 'Photo', x: 486, y: 210, w: 200, h: 175, placeholder: 'person', treat: 'halftone', caption: 'The owners with their trophy.', capSize: 11, capFont: 'Libre Baskerville', start: 70, dur: 18 });
      const hi = P('marker', { name: 'Highlighter', target: head.id, style: 'highlight', color: '#ffe14a', start: 110, dur: 30 });
      const ring = P('marker', { name: 'Red circle', style: 'circle', color: '#d90429', x: 478, y: 202, w: 216, h: 190, width: 5, start: 150, dur: 30 });
      const t1 = P('deco', { name: 'Tape (left)', x: -26, y: 6, w: 112, h: 32, rot: -38, start: 20, dur: 10 });
      const t2 = P('deco', { name: 'Tape (right)', x: 634, y: 4, w: 112, h: 32, rot: 36, start: 24, dur: 10 });
      return { name: 'Clipping on cork', frames: 220, camera: { x: 360, y: 250, zoom: 1.3, rot: 0 }, scene: { type: 'cork', color: '#2a2f36' },
        paper: { w: 720, h: 500, stock: 'newsprint', edge: 'torn', fold: 'none', wear: .45, tilt: -2.5, enter: 'drop', start: 0, dur: 26, easing: 'backOut' },
        parts: [cols, photo, rule, by, head, hi, ring, t1, t2],
        shots: [S('focus', 40, { name: 'Focus: headline', target: head.id, dur: 40, fill: .9 }), S('focus', 122, { name: 'Focus: photo', target: photo.id, dur: 34, fill: .6 }), S('showAll', 176, { dur: 36 })] };
    },
  },
  bangla: {
    label: 'Bangla daily', icon: 'ক', peek: 262, hint: 'Front page set in Bengali type: masthead, headline, photo and columns',
    build: () => frontPage({ name: 'Bangla daily', mast: 'দৈনিক সংবাদ', mastFont: 'Noto Serif Bengali', mastWeight: 800, mastSize: 100, metaL: 'বর্ষ ৩৫ · সংখ্যা ২১৪', metaC: 'ঢাকা, মঙ্গলবার, ১৩ অক্টোবর ২০২৬', metaR: 'মূল্য: ১০ টাকা',
      head: 'দীর্ঘ প্রতীক্ষার পর উদ্বোধন হলো ঐতিহাসিক সেতু', headFont: 'Noto Serif Bengali', caps: false, headLH: 1.25, sub: 'নদীর দুই পাড়ে হাজারো মানুষের ভিড়, প্রথম দিনেই যান চলাচল শুরু', subFont: 'Noto Serif Bengali', subItalic: false,
      cap: 'সূর্যোদয়ের সময় নতুন সেতু। ছবি: নিজস্ব', side: 'ভেতরের পাতায়\n\nবাণিজ্য\nবাজেট নিয়ে আলোচনা শুরু\n\nখেলা\nফাইনালে উঠল জাতীয় দল\n\nমতামত\nশহরের যানজট ও আমাদের করণীয়\n\nসংস্কৃতি\nনদীর তীরে ফিরছে উৎসব',
      sideSize: 18, sideLH: 1.5, stamp: 'বিশেষ প্রতিবেদন', stampFont: 'Noto Serif Bengali', stampWeight: 800, body: BN_BODY, bodyFont: 'Noto Serif Bengali', bodySize: 20, cols: 3, bodyLH: 1.6, dropCap: false }),
  },
  blank: {
    label: 'Empty sheet', icon: '▢', peek: 40, hint: 'A blank page. Add your own parts.',
    build: () => newPaperProject({ name: 'Untitled newspaper', paper: { ...newPaperProject().paper, enter: 'zoom' } }),
  },
};
export const TEMPLATE_LIST = Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label, icon: t.icon, hint: t.hint, peek: t.peek }));

/** Builds a complete, valid project from a template key. */
export function buildTemplate(key) {
  const t = TEMPLATES[key]; if (!t) throw Error('Unknown template: ' + key);
  const o = t.build(), base = newPaperProject();
  return { ...base, ...o, template: key, paper: { ...base.paper, ...o.paper }, scene: { ...base.scene, ...o.scene }, camera: { ...base.camera, ...o.camera }, assets: {}, shots: o.shots || [], parts: o.parts || [] };
}
