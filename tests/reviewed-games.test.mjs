import test from 'node:test';
import assert from 'node:assert/strict';
import {readReviewedGames,storeReviewedGame,REVIEWED_GAMES_KEY} from '../src/game-modes/reviewed-games.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
const sports=EXTENDED_PACKS.find(p=>p.template==='sports-v1'),merge=EXTENDED_PACKS.find(p=>p.template==='merge-v1');
function memory(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}}
test('two open library tabs retain each others newly registered games',()=>{
 const storage=memory();const tabA=readReviewedGames(storage),tabB=readReviewedGames(storage);
 assert.deepEqual(tabA,tabB);storeReviewedGame(storage,sports);storeReviewedGame(storage,merge);
 assert.deepEqual(readReviewedGames(storage).map(p=>p.id),[merge.id,sports.id]);
 storeReviewedGame(storage,sports);assert.deepEqual(readReviewedGames(storage).map(p=>p.id),[sports.id,merge.id]);
});
test('catalogue writes respect the supplied account storage and preserve malformed data',()=>{
 const alice=memory(),bob=memory();storeReviewedGame(alice,sports);storeReviewedGame(bob,merge);
 assert.deepEqual(readReviewedGames(alice).map(p=>p.id),[sports.id]);assert.deepEqual(readReviewedGames(bob).map(p=>p.id),[merge.id]);
 alice.setItem(REVIEWED_GAMES_KEY,'unreadable');assert.throws(()=>storeReviewedGame(alice,merge));assert.equal(alice.getItem(REVIEWED_GAMES_KEY),'unreadable');
});
