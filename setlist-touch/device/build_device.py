#!/usr/bin/env python3
"""Build the JSON patch and SceneNav-compatible MIDI Effect container."""
import json
import struct
from pathlib import Path
HERE = Path(__file__).parent

def box(id_, kind, rect, **kw):
    return {'box': dict(id=id_, maxclass=kind, patching_rect=rect, **kw)}
def obj(id_, text, x, y, **kw):
    return box(id_, 'newobj', [x,y,220,22], text=text, **kw)
def msg(id_, text, x, y, **kw):
    return box(id_, 'message', [x,y,220,22], text=text, **kw)
def line(src, dst, outlet=0, inlet=0):
    return {'patchline': {'source':[src,outlet], 'destination':[dst,inlet]}}
def patch(boxes, lines, rect, **kw):
    return dict(fileversion=1, appversion=dict(major=8, minor=6, revision=0, architecture='x64', modernui=1),
                classnamespace='box', rect=rect, boxes=boxes, lines=lines, **kw)
window = patch([
    obj('control-in','inlet',20,20),obj('url-in','inlet',260,20),
    box('browser','jweb',[0,0,1200,800],url='about:blank',varname='browser',presentation=1,presentation_rect=[0,0,1200,800]),
    obj('url','prepend url',260,60),
    obj('window-js','js touch-window.js',20,100),
    obj('loaded','loadbang',20,60)
], [line('url-in','url'),line('url','browser'),line('loaded','window-js'),line('control-in','window-js')], [100,100,1200,800],
    title='Setlist Touch', openinpresentation=1, enablehscroll=0, enablevscroll=0)
boxes=[
 obj('node','node.script setlist-server.js @autostart 1',20,40),
 obj('route','route fire address url ready send',20,80),
 obj('defer','deferlow',20,120),obj('fire','prepend fire',20,160),
 obj('send-defer','deferlow',260,280),obj('send','prepend send',260,320),
 obj('mix','js mix.js',500,320),obj('mix-dict','dict setlist_touch_mix',750,320),
 obj('lom','js lom.js',20,240),obj('thisdevice','live.thisdevice',500,40),
 msg('refresh','refresh',500,80),obj('address-set','prepend set',260,120),
 msg('address','Starting Setlist Touch…',260,160,presentation=1,presentation_rect=[8,38,310,22]),
 box('open','live.text',[750,40,60,22],text='Open',texton='Open',mode=0,numinlets=1,numoutlets=2,
     parameter_enable=0,presentation=1,presentation_rect=[8,8,70,25]),
 obj('select-open','sel 1',750,80),msg('open-message','showwindow',750,120),
 obj('window','p touch-window',750,240,patcher=window),
 obj('midiin','midiin',1000,40),obj('midiout','midiout',1000,80),
 # A named dict keeps shared data alive independently of the js wrapper.
 obj('dict','dict setlist_touch_scenes',500,240)
]
lines=[line('node','route'),line('route','defer'),line('defer','fire'),line('fire','lom'),
 line('route','address-set',1),line('address-set','address'),line('route','window',2,1),
 line('route','refresh',3),line('thisdevice','refresh'),line('refresh','lom'),line('lom','node'),
 # route -> deferlow -> prepend fire preserves the index AND exact name symbol.
 line('open','select-open'),line('select-open','open-message'),line('open-message','window'),
 line('midiin','midiout'),line('route','send-defer',4),line('send-defer','send'),line('send','mix'),
 line('refresh','mix'),line('mix','node')]
data=json.dumps({'patcher':patch(boxes,lines,[100,100,1280,360],openinpresentation=1,devicewidth=330.0)},indent=1,ensure_ascii=False).encode('utf8')
(HERE/'SetlistTouch.maxpat').write_bytes(data)
ptch=data+b'\n\x00'
# SceneNav reference: ampf(4)/mmmm, meta(4)/uint32le(0), ptch(length)/JSON+LF+NUL.
(HERE/'SetlistTouch.amxd').write_bytes(b'ampf'+struct.pack('<I',4)+b'mmmm'+b'meta'+struct.pack('<I',4)+struct.pack('<I',0)+b'ptch'+struct.pack('<I',len(ptch))+ptch)
print('wrote SetlistTouch.maxpat, SetlistTouch.amxd')
