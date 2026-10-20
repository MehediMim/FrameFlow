export const ARMY_PRESETS={
  pikeShot:{name:'Pike & shot company',units:[{glyph:'pikeman',count:5,color:'#667e8c'},{glyph:'musketeer',count:6,color:'#9d4d40'},{glyph:'flag',count:1,color:'#a43d39'}]},
  siege:{name:'Siege army',units:[{glyph:'musketeer',count:4,color:'#9d4d40'},{glyph:'cannon',count:3,color:'#656d55'},{glyph:'supplyWagon',count:2,color:'#8d6844'},{glyph:'flag',count:1,color:'#a43d39'}]},
  cavalry:{name:'Cavalry wing',units:[{glyph:'cavalry',count:6,color:'#8c493d'},{glyph:'pikeman',count:2,color:'#667e8c'},{glyph:'flag',count:1,color:'#c5a052'}]},
};
export function armyCopies(a){
  const rows=a.armyUnits||ARMY_PRESETS.pikeShot.units,units=[];
  for(let copy=0;copy<Math.min(100,a.count||1);copy++)for(const row of rows)for(let i=0;i<row.count&&units.length<100;i++)units.push({glyph:row.glyph,color:row.color||a.color});
  return units;
}
export function validateArmyUnits(units,icons){
  if(!Array.isArray(units)||!units.length||units.length>20||units.reduce((n,u)=>n+(u?.count||0),0)>100)throw Error('An army must contain 1–100 units in at most 20 rows.');
  for(const row of units)if(!row||!Object.hasOwn(icons,row.glyph)||['army','image','banner','artwork'].includes(row.glyph)||!Number.isInteger(row.count)||row.count<1||row.count>100||(row.color!==undefined&&!/^#[a-f0-9]{6}$/i.test(row.color)))throw Error('Invalid army unit.');
}
