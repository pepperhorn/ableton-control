{
 "patcher": {
  "fileversion": 1,
  "appversion": {
   "major": 8,
   "minor": 6,
   "revision": 0,
   "architecture": "x64",
   "modernui": 1
  },
  "classnamespace": "box",
  "rect": [
   100,
   100,
   640,
   320
  ],
  "openinpresentation": 1,
  "devicewidth": 196.0,
  "default_fontsize": 10.0,
  "default_fontname": "Arial Bold",
  "boxes": [
   {
    "box": {
     "id": "prev",
     "maxclass": "live.text",
     "patching_rect": [
      20,
      80,
      60,
      20
     ],
     "mode": 0,
     "text": "◀ Prev",
     "texton": "◀ Prev",
     "varname": "prev",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "",
      ""
     ],
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Previous Scene",
       "parameter_shortname": "Prev",
       "parameter_type": 2,
       "parameter_mmax": 1,
       "parameter_enum": [
        "off",
        "on"
       ]
      }
     },
     "presentation": 1,
     "presentation_rect": [
      6,
      6,
      58,
      24
     ]
    }
   },
   {
    "box": {
     "id": "launch",
     "maxclass": "live.text",
     "patching_rect": [
      110,
      80,
      60,
      20
     ],
     "mode": 0,
     "text": "Launch",
     "texton": "Launch",
     "varname": "launch",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "",
      ""
     ],
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Launch Selected Scene",
       "parameter_shortname": "Launch",
       "parameter_type": 2,
       "parameter_mmax": 1,
       "parameter_enum": [
        "off",
        "on"
       ]
      }
     },
     "presentation": 1,
     "presentation_rect": [
      68,
      6,
      58,
      24
     ]
    }
   },
   {
    "box": {
     "id": "next",
     "maxclass": "live.text",
     "patching_rect": [
      200,
      80,
      60,
      20
     ],
     "mode": 0,
     "text": "Next ▶",
     "texton": "Next ▶",
     "varname": "next",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "",
      ""
     ],
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Next Scene",
       "parameter_shortname": "Next",
       "parameter_type": 2,
       "parameter_mmax": 1,
       "parameter_enum": [
        "off",
        "on"
       ]
      }
     },
     "presentation": 1,
     "presentation_rect": [
      130,
      6,
      58,
      24
     ]
    }
   },
   {
    "box": {
     "id": "sel-prev",
     "maxclass": "newobj",
     "patching_rect": [
      20,
      120,
      40,
      22
     ],
     "text": "sel 1",
     "numinlets": 2,
     "numoutlets": 2,
     "outlettype": [
      "",
      ""
     ]
    }
   },
   {
    "box": {
     "id": "sel-launch",
     "maxclass": "newobj",
     "patching_rect": [
      110,
      120,
      40,
      22
     ],
     "text": "sel 1",
     "numinlets": 2,
     "numoutlets": 2,
     "outlettype": [
      "",
      ""
     ]
    }
   },
   {
    "box": {
     "id": "sel-next",
     "maxclass": "newobj",
     "patching_rect": [
      200,
      120,
      40,
      22
     ],
     "text": "sel 1",
     "numinlets": 2,
     "numoutlets": 2,
     "outlettype": [
      "",
      ""
     ]
    }
   },
   {
    "box": {
     "id": "m-prev",
     "maxclass": "message",
     "patching_rect": [
      20,
      150,
      40,
      22
     ],
     "text": "prev",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "m-launch",
     "maxclass": "message",
     "patching_rect": [
      110,
      150,
      50,
      22
     ],
     "text": "launch",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "m-next",
     "maxclass": "message",
     "patching_rect": [
      200,
      150,
      40,
      22
     ],
     "text": "next",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "wrap",
     "maxclass": "live.toggle",
     "patching_rect": [
      300,
      80,
      15,
      15
     ],
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "varname": "wrap",
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Wrap Around",
       "parameter_shortname": "Wrap",
       "parameter_type": 2,
       "parameter_mmax": 1,
       "parameter_enum": [
        "off",
        "on"
       ]
      }
     },
     "presentation": 1,
     "presentation_rect": [
      6,
      38,
      15,
      15
     ]
    }
   },
   {
    "box": {
     "id": "wrap-label",
     "maxclass": "comment",
     "patching_rect": [
      320,
      78,
      40,
      20
     ],
     "text": "Wrap",
     "numinlets": 1,
     "numoutlets": 0,
     "presentation": 1,
     "presentation_rect": [
      22,
      36,
      36,
      20
     ]
    }
   },
   {
    "box": {
     "id": "p-wrap",
     "maxclass": "newobj",
     "patching_rect": [
      300,
      150,
      80,
      22
     ],
     "text": "prepend wrap",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "thisdevice",
     "maxclass": "newobj",
     "patching_rect": [
      400,
      80,
      90,
      22
     ],
     "text": "live.thisdevice",
     "numinlets": 1,
     "numoutlets": 3,
     "outlettype": [
      "",
      "",
      ""
     ]
    }
   },
   {
    "box": {
     "id": "m-refresh",
     "maxclass": "message",
     "patching_rect": [
      400,
      150,
      55,
      22
     ],
     "text": "refresh",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "js",
     "maxclass": "newobj",
     "patching_rect": [
      20,
      200,
      90,
      22
     ],
     "text": "js SceneNav.js",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "display",
     "maxclass": "message",
     "patching_rect": [
      20,
      240,
      200,
      22
     ],
     "text": "—",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "presentation": 1,
     "presentation_rect": [
      60,
      34,
      128,
      22
     ]
    }
   },
   {
    "box": {
     "id": "midiin",
     "maxclass": "newobj",
     "patching_rect": [
      520,
      80,
      45,
      22
     ],
     "text": "midiin",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ]
    }
   },
   {
    "box": {
     "id": "midiout",
     "maxclass": "newobj",
     "patching_rect": [
      520,
      120,
      50,
      22
     ],
     "text": "midiout",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": []
    }
   }
  ],
  "lines": [
   {
    "patchline": {
     "source": [
      "prev",
      0
     ],
     "destination": [
      "sel-prev",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "launch",
      0
     ],
     "destination": [
      "sel-launch",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "next",
      0
     ],
     "destination": [
      "sel-next",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "sel-prev",
      0
     ],
     "destination": [
      "m-prev",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "sel-launch",
      0
     ],
     "destination": [
      "m-launch",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "sel-next",
      0
     ],
     "destination": [
      "m-next",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "m-prev",
      0
     ],
     "destination": [
      "js",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "m-launch",
      0
     ],
     "destination": [
      "js",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "m-next",
      0
     ],
     "destination": [
      "js",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "wrap",
      0
     ],
     "destination": [
      "p-wrap",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "p-wrap",
      0
     ],
     "destination": [
      "js",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "thisdevice",
      0
     ],
     "destination": [
      "m-refresh",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "m-refresh",
      0
     ],
     "destination": [
      "js",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "js",
      0
     ],
     "destination": [
      "display",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "midiin",
      0
     ],
     "destination": [
      "midiout",
      0
     ]
    }
   }
  ]
 }
}