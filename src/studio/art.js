// Illustration for a chapter card. Each game format has a small set of scenes;
// the chapter id picks one, so a list of same-format chapters no longer repeats one picture.
const G='/game-modes/';
const SETS={
  'adventure-v1':['art/room-workshop','art/room-quay','art/room-archive','art/room-woods','art/room-garden','art/room-tower'],
  'draft-v1':['expansion-art/cards-steam','expansion-art/cards-loom','expansion-art/cards-rail','art/table-draft'],
  'economy-v1':['expansion-art/novel-foundry','expansion-art/novel-square','expansion-art/cards-river'],
  'town-v1':['town-art/backdrop','town-art/market','art/room-woods'],
  'underlight-v1':['art/room-archive','art/room-tower'],
  'novel-v1':['extended-art/backgrounds/vn','expansion-art/novel-square'],
  'quiz-v1':['extended-art/backgrounds/quiz'],
  'sports-v1':['extended-art/backgrounds/sports'],
  'merge-v1':['extended-art/backgrounds/merge','expansion-art/merge-bench'],
};

export function templateArt(template,seed=''){
  const set=SETS[template]||SETS['adventure-v1'];
  if(typeof seed==="number")return G+set[seed%set.length]+".webp";
  let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
  return G+set[h%set.length]+'.webp';
}
