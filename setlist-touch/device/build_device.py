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
 obj('route','route fire address url ready send progress',20,80),
 obj('defer','deferlow',20,120),obj('fire','prepend fire',20,160),
 obj('send-defer','deferlow',260,280),obj('send','prepend send',260,320),
 obj('mix','js mix.js',500,320),obj('mix-dict','dict setlist_touch_mix',750,320),
 obj('player-route','route players effectSend',1000,300),obj('player-defer','deferlow',1000,340),
 obj('players','js players.js',1000,380),obj('effect-defer','deferlow',700,380),obj('effect-send','prepend effectSend',700,420),
 obj('timing-route','route timing',1000,450),obj('timing-defer','deferlow',1000,490),
 obj('transport-route','route transport',1000,120),obj('transport-defer','deferlow',1000,160),
 obj('transport','js transport.js',1000,240),
 obj('lom','js lom.js',20,240),obj('thisdevice','live.thisdevice',500,40),
 msg('refresh','refresh',500,80),msg('ready','ready',500,120),obj('address-set','prepend set',260,120),
 obj('index-status','sprintf Indexing scenes %ld / %ld…',260,200),
 msg('address','Starting Setlist Touch…',260,160,presentation=1,presentation_rect=[8,38,310,110]),
 box('open','live.text',[750,40,60,22],text='Open',texton='Open',mode=0,numinlets=1,numoutlets=2,
     parameter_enable=0,presentation=1,presentation_rect=[8,8,70,25]),
 obj('select-open','t b b',750,80),msg('pcontrol-open','open',900,120),
 obj('pcontrol','pcontrol',900,160),msg('open-message','showwindow',750,120),
 obj('window','p touch-window',750,240,patcher=window),
 obj('midiin','midiin',1000,40),obj('midiout','midiout',1000,80),
 # A named dict keeps shared data alive independently of the js wrapper.
 obj('dict','dict setlist_touch_scenes',500,240)
]
lines=[line('node','route'),line('route','defer'),line('defer','fire'),line('fire','lom'),
 line('route','address-set',1),line('address-set','address'),line('route','window',2,1),
 line('route','ready',3),line('thisdevice','refresh'),line('refresh','lom'),line('lom','node'),
 # route -> deferlow -> prepend fire preserves the index AND exact name symbol.
 # Trigger fires right-to-left: pcontrol opens before the helper fits/fronts.
 line('open','select-open'),line('select-open','pcontrol-open',1),line('pcontrol-open','pcontrol'),line('pcontrol','window'),line('select-open','open-message'),line('open-message','window'),
 line('midiin','midiout'),line('route','send-defer',4),line('send-defer','send'),line('send','mix'),
 line('refresh','mix'),line('ready','lom'),line('ready','mix'),line('ready','transport'),line('mix','node'),
 # Preserve existing selectors; the unmatched outlet feeds the transport lane.
 line('route','index-status',5),line('index-status','address-set'),
 line('route','player-route',6),line('player-route','player-defer'),line('player-defer','players'),line('players','node'),line('refresh','players'),line('player-route','effect-defer',1),line('effect-defer','effect-send'),line('effect-send','mix'),line('player-route','timing-route',2),line('timing-route','timing-defer'),line('timing-defer','lom'),line('timing-route','transport-route',1),line('transport-route','transport-defer'),
 line('transport-defer','transport'),line('refresh','transport'),line('transport','node')]
data=json.dumps({'patcher':patch(boxes,lines,[100,100,1280,360],openinpresentation=1,devicewidth=330.0)},indent=1,ensure_ascii=False).encode('utf8')
(HERE/'SetlistTouch.maxpat').write_bytes(data)
ptch=data+b'\n\x00'
# SceneNav reference: ampf(4)/mmmm, meta(4)/uint32le(0), ptch(length)/JSON+LF+NUL.
(HERE/'SetlistTouch.amxd').write_bytes(b'ampf'+struct.pack('<I',4)+b'mmmm'+b'meta'+struct.pack('<I',4)+struct.pack('<I',0)+b'ptch'+struct.pack('<I',len(ptch))+ptch)
print('wrote SetlistTouch.maxpat, SetlistTouch.amxd')
