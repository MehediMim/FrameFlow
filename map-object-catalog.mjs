import { OBJECT_ICONS } from './map-objects.mjs';
import { ISOMETRIC_MODELS } from './map-isometric-objects.mjs';

// One classification for both views and every object picker.
export const OBJECT_CATEGORIES = [
  ['people','People & occupations'], ['mounted','Riders & cavalry'],
  ['buildings','Buildings & settlements'], ['defenses','Castles, defenses & walls'],
  ['landmarks','Famous landmarks'], ['infrastructure','Bridges & infrastructure'],
  ['vehicles','Vehicles & transport'], ['ships','Ships & boats'],
  ['aircraft','Aircraft & missiles'], ['weapons','Cannons & artillery'],
  ['armies','Army formations'], ['animals','Animals'], ['nature','Nature & weather'],
  ['goods','Trade & cargo'], ['images','Images, portraits & flags'],
  ['time','Time & planning'], ['accessories','Navigation & accessories'],
];
const familyGroups={person:'people',mounted:'mounted',building:'buildings',fort:'defenses',landmark:'landmarks',bridge:'infrastructure',vehicle:'vehicles',ship:'ships',aircraft:'aircraft',gun:'weapons',formation:'armies',animal:'animals',nature:'nature',goods:'goods',image:'images',time:'time',accessory:'accessories'};
const overrides={windTurbine:'infrastructure',solarFarm:'infrastructure',stepwell:'infrastructure',checkpoint:'infrastructure',tradePort:'infrastructure',bicycle:'vehicles',palanquin:'vehicles',storm:'nature'};
export const objectCategory=glyph=>overrides[glyph]||familyGroups[ISOMETRIC_MODELS[glyph]?.family]||'accessories';
export const objectEntries=group=>Object.entries(OBJECT_ICONS).filter(([glyph])=>objectCategory(glyph)===group).sort((a,b)=>a[1].label.localeCompare(b[1].label));
