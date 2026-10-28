#!/usr/bin/env python3
"""Build SceneNav.maxpat and SceneNav.amxd (Max MIDI Effect) from one patcher definition."""
import json
import struct
from pathlib import Path

HERE = Path(__file__).parent


def box(id_, maxclass, rect, pres=None, **kw):
    b = {"id": id_, "maxclass": maxclass, "patching_rect": rect, **kw}
    if pres:
        b["presentation"] = 1
        b["presentation_rect"] = pres
    return {"box": b}


def button(id_, text, longname, shortname, rect, pres):
    return box(
        id_, "live.text", rect, pres,
        mode=0, text=text, texton=text, varname=shortname.lower(),
        numinlets=1, numoutlets=2, outlettype=["", ""],
        parameter_enable=1,
        saved_attribute_attributes={"valueof": {
            "parameter_longname": longname,
            "parameter_shortname": shortname,
            "parameter_type": 2,
            "parameter_mmax": 1,
            "parameter_enum": ["off", "on"],
        }},
    )


def obj(id_, text, rect, ins=1, outs=1):
    return box(id_, "newobj", rect, text=text, numinlets=ins, numoutlets=outs,
               outlettype=[""] * outs)


def msg(id_, text, rect, pres=None):
    return box(id_, "message", rect, pres, text=text, numinlets=2, numoutlets=1,
               outlettype=[""])


def line(src, dst, outlet=0, inlet=0):
    return {"patchline": {"source": [src, outlet], "destination": [dst, inlet]}}


boxes = [
    button("prev", "◀ Prev", "Previous Scene", "Prev", [20, 80, 60, 20], [6, 6, 58, 24]),
    button("launch", "Launch", "Launch Selected Scene", "Launch", [110, 80, 60, 20], [68, 6, 58, 24]),
    button("next", "Next ▶", "Next Scene", "Next", [200, 80, 60, 20], [130, 6, 58, 24]),
    obj("sel-prev", "sel 1", [20, 120, 40, 22], 2, 2),
    obj("sel-launch", "sel 1", [110, 120, 40, 22], 2, 2),
    obj("sel-next", "sel 1", [200, 120, 40, 22], 2, 2),
    msg("m-prev", "prev", [20, 150, 40, 22]),
    msg("m-launch", "launch", [110, 150, 50, 22]),
    msg("m-next", "next", [200, 150, 40, 22]),
    box("wrap", "live.toggle", [300, 80, 15, 15], [6, 38, 15, 15],
        numinlets=1, numoutlets=1, outlettype=[""], varname="wrap", parameter_enable=1,
        saved_attribute_attributes={"valueof": {
            "parameter_longname": "Wrap Around",
            "parameter_shortname": "Wrap",
            "parameter_type": 2,
            "parameter_mmax": 1,
            "parameter_enum": ["off", "on"],
        }}),
    box("wrap-label", "comment", [320, 78, 40, 20], [22, 36, 36, 20], text="Wrap",
        numinlets=1, numoutlets=0),
    obj("p-wrap", "prepend wrap", [300, 150, 80, 22]),
    obj("thisdevice", "live.thisdevice", [400, 80, 90, 22], 1, 3),
    msg("m-refresh", "refresh", [400, 150, 55, 22]),
    obj("js", "js SceneNav.js", [20, 200, 90, 22]),
    msg("display", "—", [20, 240, 200, 22], [60, 34, 128, 22]),
    obj("midiin", "midiin", [520, 80, 45, 22], 1, 1),
    obj("midiout", "midiout", [520, 120, 50, 22], 1, 0),
]

lines = [
    line("prev", "sel-prev"), line("launch", "sel-launch"), line("next", "sel-next"),
    line("sel-prev", "m-prev"), line("sel-launch", "m-launch"), line("sel-next", "m-next"),
    line("m-prev", "js"), line("m-launch", "js"), line("m-next", "js"),
    line("wrap", "p-wrap"), line("p-wrap", "js"),
    line("thisdevice", "m-refresh"), line("m-refresh", "js"),
    line("js", "display"),
    line("midiin", "midiout"),
]

patcher = {"patcher": {
    "fileversion": 1,
    "appversion": {"major": 8, "minor": 6, "revision": 0, "architecture": "x64", "modernui": 1},
    "classnamespace": "box",
    "rect": [100, 100, 640, 320],
    "openinpresentation": 1,
    "devicewidth": 196.0,
    "default_fontsize": 10.0,
    "default_fontname": "Arial Bold",
    "boxes": boxes,
    "lines": lines,
}}

data = json.dumps(patcher, indent=1, ensure_ascii=False).encode("utf-8")
(HERE / "SceneNav.maxpat").write_bytes(data)

# .amxd container: ampf header (mmmm = MIDI Effect), meta chunk, ptch chunk with patcher JSON.
ptch = data + b"\n\x00"
amxd = (b"ampf" + struct.pack("<I", 4) + b"mmmm"
        + b"meta" + struct.pack("<I", 4) + struct.pack("<I", 0)
        + b"ptch" + struct.pack("<I", len(ptch)) + ptch)
(HERE / "SceneNav.amxd").write_bytes(amxd)
print("wrote SceneNav.maxpat, SceneNav.amxd")
