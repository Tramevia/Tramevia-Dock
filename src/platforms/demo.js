// Demo mode (--demo / DEMO=1): fake accounts, chat, events and stats so the UI can be tried
// and screenshotted without any platform account. Never persisted.
import { randomId } from '../crypto.js';

const EMOTE = id => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`;
const BOXART = id => `https://static-cdn.jtvnw.net/ttv-boxart/${id}-144x192.jpg`;
const CATEGORIES = [
  ['509658', 'Just Chatting'], ['27471', 'Minecraft'], ['33214', 'Fortnite'], ['21779', 'League of Legends'],
  ['516575', 'VALORANT'], ['32982', 'Grand Theft Auto V'], ['509660', 'Art'], ['26936', 'Music'],
  ['1469308723', 'Software and Game Development'], ['512710', 'Call of Duty: Warzone'], ['511224', 'Apex Legends'],
  ['29595', 'Dota 2'], ['32399', 'Counter-Strike'], ['490100', 'Lost Ark'], ['518203', 'Sports'],
].map(([id, name]) => ({ id, name, image: BOXART(id) }));

export const DEMO_ACCOUNTS = [
  { id: 'demo-tw1', platform: 'twitch', platformUserId: '1001', login: 'tramevia', displayName: 'tramevia' },
  { id: 'demo-tw2', platform: 'twitch', platformUserId: '1002', login: 'tramevia_tv', displayName: 'TrameviaTV' },
  { id: 'demo-kick', platform: 'kick', platformUserId: '2001', login: 'tramevia', displayName: 'tramevia' },
  { id: 'demo-yt', platform: 'youtube', platformUserId: 'UCdemo', login: 'tramevia', displayName: 'Tramevia' },
  { id: 'demo-tt', platform: 'tiktok', platformUserId: 'tramevia', login: 'tramevia', displayName: 'tramevia' },
];

const PEOPLE = [
  ['PixelPanda', '#ff7eb6', ['subscriber']], ['Lunatik_', '#7ee0ff', []], ['ChefMarmotte', '#ffd166', ['vip']],
  ['NoxModo', '#06d6a0', ['moderator']], ['Baguette3000', '', []], ['Kaori', '#c39bff', ['subscriber']],
  ['xXdarkSasukeXx', '#ef476f', []], ['MamieGamer', '#f4a261', ['subscriber']], ['Nightbot', '#8e8e8e', ['bot', 'moderator']],
  ['Zéphyr', '#90be6d', []], ['captain_kirk', '#4cc9f0', []], ['Mélodie', '#f72585', ['member']],
];
const LINES = [
  ['Salut tout le monde ! ', 'emote:Kappa:25'], ['GG c’était propre'], ['On est là pour la ranked ce soir ?'],
  ['emote:LUL:425618', ' mais non la chute'], ['@{streamer} tu peux montrer ta config ?'], ['first time here, hi!'],
  ['Le son est un peu faible'], ['emote:PogChamp:305954156', ' ', 'emote:PogChamp:305954156', ' clutch !'],
  ['Qui vient du TikTok ?'], ['https://example.com/tier-list ça vous dit ?'], ['Bonne soirée la team ', 'emote:HeyGuys:30259'],
  ['Le titre du live est trop bien'], ['Combien de temps le live aujourd’hui ?'], ['Allez on vise le top 1'],
];
const EVENTS = {
  twitch: [
    { type: 'follow' }, { type: 'sub', tier: '1000' }, { type: 'resub', tier: '1000', months: 14, text: 'Toujours là !' },
    { type: 'giftsub', count: 5, tier: '1000' }, { type: 'cheer', amount: 500, text: 'Cheer500 trop fort' },
    { type: 'raid', count: 42 }, { type: 'redemption', label: 'Hydrate-toi', amount: 300 },
    { type: 'announcement', text: 'Tournoi communautaire samedi 20h, inscriptions sur le Discord !' },
  ],
  kick: [{ type: 'follow' }, { type: 'sub' }, { type: 'giftsub', count: 3 }, { type: 'kicks', amount: 100, label: 'Rage Quit' }],
  youtube: [
    { type: 'superchat', amount: 5, currency: 'EUR', text: 'Merci pour les conseils !' }, { type: 'membership', label: 'Membre' },
    { type: 'supersticker', amount: 2, currency: 'EUR' }, { type: 'giftmembership', count: 5 },
    { type: 'gift', label: 'Cœur', count: 3, amount: 30, unit: 'jewels' },
  ],
  tiktok: [{ type: 'follow' }, { type: 'gift', label: 'Rose', count: 10, amount: 10, unit: 'diamonds' }, { type: 'like', count: 250, user: null }, { type: 'share' }, { type: 'sub' }],
};

const pick = list => list[Math.floor(Math.random() * list.length)];
const YT_CATEGORIES = [['1', 'Film & Animation'], ['10', 'Music'], ['17', 'Sports'], ['20', 'Gaming'], ['22', 'People & Blogs'], ['24', 'Entertainment'], ['27', 'Education'], ['28', 'Science & Technology']]
  .map(([id, title]) => ({ id, title }));

function replyContext(ctx, id) {
  const parent = ctx.hub.backlog().find(f => f.t === 'chat' && f.d.id === id)?.d;
  return { id, author: parent?.author.name || '', text: parent?.text || '' };
}
const info = new Map(DEMO_ACCOUNTS.map(a => [a.id, {
  title: 'Soirée chill & ranked avec vous ! !discord',
  category: a.platform === 'youtube' || a.platform === 'tiktok' ? null : CATEGORIES[0],
  tags: a.platform === 'twitch' ? ['Français', 'Chill', 'FR'] : a.platform === 'kick' ? ['French'] : a.platform === 'youtube' ? ['live', 'gaming'] : [],
  language: 'fr', labels: [], brandedContent: false,
  description: a.platform === 'youtube' ? 'Live gaming et discussion. Rejoins le Discord !' : undefined,
  ytCategoryId: a.platform === 'youtube' ? '20' : undefined,
}]));
const viewers = new Map(DEMO_ACCOUNTS.map(a => [a.id, 20 + Math.floor(Math.random() * 200)]));
let quotaUsed = 2_150;
let likes = 4_800;

function fragments(line, streamer) {
  return line.map(part => {
    if (part.startsWith('emote:')) {
      const [, name, id] = part.split(':');
      return { t: 'emote', name, url: EMOTE(id) };
    }
    return { t: 'text', v: part.replace('{streamer}', streamer) };
  });
}

function message(ctx, account, author, frags, extra = {}) {
  const tokens = ctx.tokenize({ platform: account.platform, channelId: account.platformUserId, fragments: frags });
  ctx.emitChat({
    id: randomId(8), platform: account.platform, accountId: account.id, channel: account.login, ts: Date.now(),
    author, text: frags.map(f => f.t === 'text' ? f.v : f.name).join(''), tokens, reply: null,
    flags: { first: false, action: false, highlight: false, self: false, ...extra.flags }, deleted: false, ...extra.msg,
  });
}

// Real Twitch badge images (static CDN) so the demo shows the same shapes as live Twitch messages.
const TWITCH_BADGES = {
  broadcaster: '5527c58c-fb7d-422d-b71b-f309dcb85cc1', moderator: '3267646d-33f0-4b17-b3df-f923a41db1d0',
  vip: 'b817aba4-fad8-49e2-b88a-7cc744dfa6ec', subscriber: '5d9f2208-5dd8-11e7-8513-2ff4adfae661',
};
const badgesFor = (platform, roles) => platform !== 'twitch' ? [] : roles.filter(r => TWITCH_BADGES[r])
  .map(r => ({ id: r, title: r, url: `https://static-cdn.jtvnw.net/badges/v1/${TWITCH_BADGES[r]}/2` }));

function randomAuthor(account) {
  const [name, color, roles] = pick(PEOPLE);
  return {
    id: `${account.platform}-${name}`, login: name.toLowerCase(), name, color,
    avatar: '', roles, badges: badgesFor(account.platform, roles),
  };
}

export default {
  id: 'demo',
  name: 'Demo',

  start(ctx) {
    for (const account of DEMO_ACCOUNTS) ctx.accounts.addDemo(account);
    const chatTimer = setInterval(() => {
      const account = pick(DEMO_ACCOUNTS);
      const author = randomAuthor(account);
      const first = Math.random() < 0.06;
      // Now and then, a viewer replies to a recent message of the same channel.
      const parent = Math.random() < 0.12 && ctx.hub.backlog().reverse().find(f => f.t === 'chat' && f.d.accountId === account.id)?.d;
      message(ctx, account, author, fragments(parent ? [`@${parent.author.name} `, 'carrément !'] : pick(LINES), account.login), {
        flags: { first, highlight: first }, msg: parent ? { reply: { id: parent.id, author: parent.author.name, text: parent.text } } : {},
      });
    }, 1400);
    const eventTimer = setInterval(() => {
      const account = pick(DEMO_ACCOUNTS);
      const author = randomAuthor(account);
      const evt = pick(EVENTS[account.platform]);
      ctx.emitEvent({
        id: randomId(8), platform: account.platform, accountId: account.id, channel: account.login, ts: Date.now(),
        user: { id: author.id, name: author.name }, ...evt,
        tokens: evt.text ? ctx.tokenize({ platform: account.platform, channelId: account.platformUserId, fragments: [{ t: 'text', v: evt.text }] }) : undefined,
      });
    }, 9000);
    chatTimer.unref();
    eventTimer.unref();
  },

  connect() { return { stop() {} }; },

  statsInterval: 8000,
  async stats(ctx, account) {
    const v = Math.max(3, viewers.get(account.id) + Math.round((Math.random() - 0.45) * 12));
    viewers.set(account.id, v);
    const i = info.get(account.id);
    const extra = account.platform === 'youtube' ? { quota: { used: (quotaUsed = quotaUsed >= 7_000 ? 2_150 : quotaUsed + 40), limit: 10_000 } }
      : account.platform === 'tiktok' ? { likes: (likes += Math.floor(Math.random() * 300)) }
        : account.platform === 'kick' ? { subscribers: 128 } : {};
    return { live: true, viewers: v, startedAt: Date.now() - 5_400_000, title: i.title, category: i.category?.name || '', ...extra };
  },

  async chatters(ctx, account) {
    // Same shape as Twitch's real list: only broadcaster / moderator / vip / bot roles are known there.
    const known = new Set(['moderator', 'vip', 'bot']);
    return PEOPLE.map(([name, , roles]) => ({ id: `${account.platform}-${name}`, login: name.toLowerCase(), name, roles: roles.filter(r => known.has(r)) }))
      .concat([{ id: account.platformUserId, login: account.login, name: account.displayName, roles: ['broadcaster'] }]);
  },

  async getInfo(ctx, account) { return structuredClone(info.get(account.id)); },

  async setInfo(ctx, account, changes) {
    await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
    Object.assign(info.get(account.id), structuredClone(changes));
  },

  async searchCategories(ctx, account, query) {
    const q = query.toLowerCase();
    return CATEGORIES.filter(c => c.name.toLowerCase().includes(q)).slice(0, 10);
  },

  async send(ctx, account, { text, replyTo }) {
    message(ctx, account, {
      id: account.platformUserId, login: account.login, name: account.displayName, color: '#bd9bff', avatar: '',
      roles: ['broadcaster'], badges: badgesFor(account.platform, ['broadcaster']),
    }, [{ t: 'text', v: text }], { flags: { self: true }, msg: { reply: replyTo ? replyContext(ctx, replyTo) : null } });
    return { ok: true };
  },

  async moderate(ctx, account, action) {
    if (action.action === 'delete') ctx.emitDelete({ accountId: account.id, messageId: action.messageId });
    else if (action.action === 'timeout' || action.action === 'ban') ctx.emitDelete({ accountId: account.id, userId: action.userId });
    return { ok: true };
  },

  async infoOptions(ctx, account) {
    return account.platform === 'youtube' ? { ytCategories: YT_CATEGORIES } : {};
  },

  async marker() { return { ok: true }; },
  async clip() { return { ok: true, url: 'https://clips.twitch.tv/' }; },
};
