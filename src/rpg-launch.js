import {draftHash} from './game-modes/draft-engine.js';

// A programme link selects an exact chapter, including for signed-out learners.
// An unavailable link must never quietly start an unrelated adventure.
export async function resolveAdventureLink(search, included, fetchSaved) {
 const q=new URLSearchParams(search),id=q.get('rpg'),hash=q.get('hash');
 if(!id&&!hash)return null;
 if(!id||!hash)throw Error('This adventure link is incomplete. Return to your learning programme.');
 const exact=included.find(b=>b.id===id&&draftHash(b)===hash);
 if(exact)return exact;
 if(!fetchSaved)throw Error('Sign in to open this saved chapter, or return to your learning programme.');
 const result=await fetchSaved(id,hash),bundle=result?.content;
 if(!bundle||bundle.id!==id||draftHash(bundle)!==hash)throw Error('This exact chapter is unavailable. Return to your learning programme.');
 return bundle;
}
