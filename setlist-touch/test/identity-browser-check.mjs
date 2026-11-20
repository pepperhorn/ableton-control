// Run this export in the shared preview at 390x844 and 1280x800 against dev.js.
// It checks real layout boxes using the production renderer and stylesheet.
export async function checkSceneBarFit() {
 const {renderSceneWindow} = await import(new URL('/js/scene-window-render.js',location.origin));
 const bar=document.querySelector('.scene-bar');
 if (document.querySelector('.mix-panel').hidden) throw Error('Open My mix before checking');
 const long='A very long scene name that must be ellipsised '.repeat(6);
 renderSceneWindow(bar,{rows:[0,1,2].map(index=>({index,name:long+index,color:255,role:index===0?'current':'after',progress:index===0?{bar:2,bars:32,fraction:.1}:null,bars:32}))},{large:false,canLaunch:false,locked:true});
 const box=bar.getBoundingClientRect();const rows=[...bar.children].map(n=>{
  const r=n.getBoundingClientRect(),name=n.querySelector('.scene-window-name'),style=getComputedStyle(name);
  if(r.left<box.left || r.right>box.right || r.bottom>box.bottom || r.bottom>innerHeight)throw Error('Scene bar clips a row');
  if(style.textOverflow!=='ellipsis' || style.whiteSpace!=='nowrap' || name.scrollWidth<=name.clientWidth)throw Error('Long name does not ellipsise');
  return {width:r.width,height:r.height,bottom:r.bottom};
 });
 if(rows.length!==3 || bar.scrollWidth>bar.clientWidth)throw Error('Scene bar does not fit all three rows');
 return {viewport:[innerWidth,innerHeight],bar:{width:box.width,height:box.height},rows};
}
