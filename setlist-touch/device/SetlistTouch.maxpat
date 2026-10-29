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
   1280,
   360
  ],
  "boxes": [
   {
    "box": {
     "id": "node",
     "maxclass": "newobj",
     "patching_rect": [
      20,
      40,
      220,
      22
     ],
     "text": "node.script setlist-server.js @autostart 1"
    }
   },
   {
    "box": {
     "id": "route",
     "maxclass": "newobj",
     "patching_rect": [
      20,
      80,
      220,
      22
     ],
     "text": "route fire address url ready send progress"
    }
   },
   {
    "box": {
     "id": "defer",
     "maxclass": "newobj",
     "patching_rect": [
      20,
      120,
      220,
      22
     ],
     "text": "deferlow"
    }
   },
   {
    "box": {
     "id": "fire",
     "maxclass": "newobj",
     "patching_rect": [
      20,
      160,
      220,
      22
     ],
     "text": "prepend fire"
    }
   },
   {
    "box": {
     "id": "send-defer",
     "maxclass": "newobj",
     "patching_rect": [
      260,
      280,
      220,
      22
     ],
     "text": "deferlow"
    }
   },
   {
    "box": {
     "id": "send",
     "maxclass": "newobj",
     "patching_rect": [
      260,
      320,
      220,
      22
     ],
     "text": "prepend send"
    }
   },
   {
    "box": {
     "id": "mix",
     "maxclass": "newobj",
     "patching_rect": [
      500,
      320,
      220,
      22
     ],
     "text": "js mix.js"
    }
   },
   {
    "box": {
     "id": "mix-dict",
     "maxclass": "newobj",
     "patching_rect": [
      750,
      320,
      220,
      22
     ],
     "text": "dict setlist_touch_mix"
    }
   },
   {
    "box": {
     "id": "transport-route",
     "maxclass": "newobj",
     "patching_rect": [
      1000,
      120,
      220,
      22
     ],
     "text": "route transport"
    }
   },
   {
    "box": {
     "id": "transport-defer",
     "maxclass": "newobj",
     "patching_rect": [
      1000,
      160,
      220,
      22
     ],
     "text": "deferlow"
    }
   },
   {
    "box": {
     "id": "transport",
     "maxclass": "newobj",
     "patching_rect": [
      1000,
      240,
      220,
      22
     ],
     "text": "js transport.js"
    }
   },
   {
    "box": {
     "id": "lom",
     "maxclass": "newobj",
     "patching_rect": [
      20,
      240,
      220,
      22
     ],
     "text": "js lom.js"
    }
   },
   {
    "box": {
     "id": "thisdevice",
     "maxclass": "newobj",
     "patching_rect": [
      500,
      40,
      220,
      22
     ],
     "text": "live.thisdevice"
    }
   },
   {
    "box": {
     "id": "refresh",
     "maxclass": "message",
     "patching_rect": [
      500,
      80,
      220,
      22
     ],
     "text": "refresh"
    }
   },
   {
    "box": {
     "id": "ready",
     "maxclass": "message",
     "patching_rect": [
      500,
      120,
      220,
      22
     ],
     "text": "ready"
    }
   },
   {
    "box": {
     "id": "address-set",
     "maxclass": "newobj",
     "patching_rect": [
      260,
      120,
      220,
      22
     ],
     "text": "prepend set"
    }
   },
   {
    "box": {
     "id": "index-status",
     "maxclass": "newobj",
     "patching_rect": [
      260,
      200,
      220,
      22
     ],
     "text": "sprintf Indexing scenes %ld / %ld…"
    }
   },
   {
    "box": {
     "id": "address",
     "maxclass": "message",
     "patching_rect": [
      260,
      160,
      220,
      22
     ],
     "text": "Starting Setlist Touch…",
     "presentation": 1,
     "presentation_rect": [
      8,
      38,
      310,
      22
     ]
    }
   },
   {
    "box": {
     "id": "open",
     "maxclass": "live.text",
     "patching_rect": [
      750,
      40,
      60,
      22
     ],
     "text": "Open",
     "texton": "Open",
     "mode": 0,
     "numinlets": 1,
     "numoutlets": 2,
     "parameter_enable": 0,
     "presentation": 1,
     "presentation_rect": [
      8,
      8,
      70,
      25
     ]
    }
   },
   {
    "box": {
     "id": "select-open",
     "maxclass": "newobj",
     "patching_rect": [
      750,
      80,
      220,
      22
     ],
     "text": "sel 1"
    }
   },
   {
    "box": {
     "id": "open-message",
     "maxclass": "message",
     "patching_rect": [
      750,
      120,
      220,
      22
     ],
     "text": "showwindow"
    }
   },
   {
    "box": {
     "id": "window",
     "maxclass": "newobj",
     "patching_rect": [
      750,
      240,
      220,
      22
     ],
     "text": "p touch-window",
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
       1200,
       800
      ],
      "boxes": [
       {
        "box": {
         "id": "control-in",
         "maxclass": "newobj",
         "patching_rect": [
          20,
          20,
          220,
          22
         ],
         "text": "inlet"
        }
       },
       {
        "box": {
         "id": "url-in",
         "maxclass": "newobj",
         "patching_rect": [
          260,
          20,
          220,
          22
         ],
         "text": "inlet"
        }
       },
       {
        "box": {
         "id": "browser",
         "maxclass": "jweb",
         "patching_rect": [
          0,
          0,
          1200,
          800
         ],
         "url": "about:blank",
         "varname": "browser",
         "presentation": 1,
         "presentation_rect": [
          0,
          0,
          1200,
          800
         ]
        }
       },
       {
        "box": {
         "id": "url",
         "maxclass": "newobj",
         "patching_rect": [
          260,
          60,
          220,
          22
         ],
         "text": "prepend url"
        }
       },
       {
        "box": {
         "id": "window-js",
         "maxclass": "newobj",
         "patching_rect": [
          20,
          100,
          220,
          22
         ],
         "text": "js touch-window.js"
        }
       },
       {
        "box": {
         "id": "loaded",
         "maxclass": "newobj",
         "patching_rect": [
          20,
          60,
          220,
          22
         ],
         "text": "loadbang"
        }
       }
      ],
      "lines": [
       {
        "patchline": {
         "source": [
          "url-in",
          0
         ],
         "destination": [
          "url",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "url",
          0
         ],
         "destination": [
          "browser",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "loaded",
          0
         ],
         "destination": [
          "window-js",
          0
         ]
        }
       },
       {
        "patchline": {
         "source": [
          "control-in",
          0
         ],
         "destination": [
          "window-js",
          0
         ]
        }
       }
      ],
      "title": "Setlist Touch",
      "openinpresentation": 1,
      "enablehscroll": 0,
      "enablevscroll": 0
     }
    }
   },
   {
    "box": {
     "id": "midiin",
     "maxclass": "newobj",
     "patching_rect": [
      1000,
      40,
      220,
      22
     ],
     "text": "midiin"
    }
   },
   {
    "box": {
     "id": "midiout",
     "maxclass": "newobj",
     "patching_rect": [
      1000,
      80,
      220,
      22
     ],
     "text": "midiout"
    }
   },
   {
    "box": {
     "id": "dict",
     "maxclass": "newobj",
     "patching_rect": [
      500,
      240,
      220,
      22
     ],
     "text": "dict setlist_touch_scenes"
    }
   }
  ],
  "lines": [
   {
    "patchline": {
     "source": [
      "node",
      0
     ],
     "destination": [
      "route",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "route",
      0
     ],
     "destination": [
      "defer",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "defer",
      0
     ],
     "destination": [
      "fire",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "fire",
      0
     ],
     "destination": [
      "lom",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "route",
      1
     ],
     "destination": [
      "address-set",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "address-set",
      0
     ],
     "destination": [
      "address",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "route",
      2
     ],
     "destination": [
      "window",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "route",
      3
     ],
     "destination": [
      "ready",
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
      "refresh",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "refresh",
      0
     ],
     "destination": [
      "lom",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "lom",
      0
     ],
     "destination": [
      "node",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "open",
      0
     ],
     "destination": [
      "select-open",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "select-open",
      0
     ],
     "destination": [
      "open-message",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "open-message",
      0
     ],
     "destination": [
      "window",
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
   },
   {
    "patchline": {
     "source": [
      "route",
      4
     ],
     "destination": [
      "send-defer",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "send-defer",
      0
     ],
     "destination": [
      "send",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "send",
      0
     ],
     "destination": [
      "mix",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "refresh",
      0
     ],
     "destination": [
      "mix",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "ready",
      0
     ],
     "destination": [
      "lom",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "ready",
      0
     ],
     "destination": [
      "mix",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "ready",
      0
     ],
     "destination": [
      "transport",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "mix",
      0
     ],
     "destination": [
      "node",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "route",
      5
     ],
     "destination": [
      "index-status",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "index-status",
      0
     ],
     "destination": [
      "address-set",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "route",
      6
     ],
     "destination": [
      "transport-route",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "transport-route",
      0
     ],
     "destination": [
      "transport-defer",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "transport-defer",
      0
     ],
     "destination": [
      "transport",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "refresh",
      0
     ],
     "destination": [
      "transport",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "transport",
      0
     ],
     "destination": [
      "node",
      0
     ]
    }
   }
  ],
  "openinpresentation": 1,
  "devicewidth": 330.0
 }
}