import assert from 'node:assert/strict';
import { TRADE_OBJECTS } from '../map-trade-objects.mjs';
import { OBJECT_ICONS } from '../map-objects.mjs';
import { makeAction,newMapProject,validateMapProject,mapFontsUsed } from '../map-engine.mjs';
import { drawPlaqueText } from '../map-plaque-text.mjs';

for(const glyph of ['image','artwork','banner','portrait'])assert.equal(OBJECT_ICONS[glyph].group,'images');
for(const glyph of [...Object.keys(TRADE_OBJECTS),'cargoShip','deliveryTruck'])assert.equal(OBJECT_ICONS[glyph].group,'trade');
const p=newMapProject();p.actions=Object.keys(TRADE_OBJECTS).map(glyph=>makeAction('object',0,{glyph}));
const style={plaqueFont:'Cinzel',plaqueSize:12,plaqueWeight:600,plaqueItalic:true,plaqueColor:'#ffcc88',plaqueFit:false};
for(const glyph of ['portrait','banner'])p.actions.push(makeAction('object',0,{glyph,...style}));
validateMapProject(JSON.parse(JSON.stringify(p)));assert.ok(mapFontsUsed(p).includes('Cinzel'),'export preloads plaque fonts');
for(const invalid of [{plaqueSize:0},{plaqueSize:49},{plaqueWeight:1},{plaqueItalic:'yes'},{plaqueFit:'yes'},{plaqueColor:'gold'},{plaqueFont:3}]){
  const bad=structuredClone(p);Object.assign(bad.actions.at(-1),invalid);assert.throws(()=>validateMapProject(bad));
}
const text=[];const c={save(){},restore(){},beginPath(){},rect(){},clip(){},measureText(t){return{width:t.length*10}},fillText(t){text.push({text:t,font:this.font,color:this.fillStyle})}};
drawPlaqueText(c,26,style,'Manuel',0,0,100,30);
assert.match(text[0].font,/italic 600 12px "Cinzel"/);assert.equal(text[0].color,'#ffcc88');
text.length=0;drawPlaqueText(c,26,{...style,plaqueFit:true},'A very long title',0,0,40,30);
assert.ok(parseFloat(text[0].font.match(/([\d.]+)px/)[1])<12,'auto-fit shrinks long titles');
console.log('Image/trade categories, trade persistence, plaque fonts, sizing, auto-fit and style validation passed');
