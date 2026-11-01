import {validateExtendedContent} from './extended-content.js';
const raw=[
 {
  "schemaVersion": 1,
  "template": "novel-v1",
  "id": "riverlight-water-story",
  "topicId": "water-cycle",
  "revision": 1,
  "title": "The lanterns after rain",
  "subtitle": "One evening. Two promises. Your decision.",
  "hook": "Help Riverlight choose how to share an idea. Your route changes the conversations and the event the town holds. The setting and characters are fictional; the source notes explain the real concepts.",
  "nodes": [
   {
    "title": "The evening ahead",
    "speaker": "engineer",
    "text": "The festival opens tonight. Nessa can prepare the public waterwork or a quiet garden study. Time will not cover both. Where should the crew begin? Water can be stored as solid ice, liquid or vapour; a neat circle cannot show every route.",
    "sourceRefs": [
     "river-water"
    ],
    "choices": [
     {
      "label": "Inspect the roof rig",
      "consequence": "You spend the first visit on an observable mechanism.",
      "sourceRefs": [
       "river-water"
      ]
     },
     {
      "label": "Read the old route maps",
      "consequence": "Your first visit reveals the limits of a tidy diagram.",
      "sourceRefs": [
       "river-water"
      ]
     }
    ]
   },
   {
    "title": "At the workshop",
    "speaker": "engineer",
    "text": "At the roof rig, a tray has lost liquid and droplets cling under a cold lid. Nessa offers a closer demonstration or a delivery survey. Nessa traces the changes: evaporation takes liquid into vapour; condensation forms liquid droplets from vapour.",
    "sourceRefs": [
     "river-water"
    ],
    "choices": [
     {
      "label": "Follow the two state changes",
      "consequence": "The workshop demonstration becomes your next scene.",
      "sourceRefs": [
       "river-water"
      ]
     },
     {
      "label": "Survey the garden route",
      "consequence": "The garden team receives your remaining setup time.",
      "sourceRefs": [
       "river-water"
      ]
     }
    ]
   },
   {
    "title": "Inside the archive",
    "speaker": "archivist",
    "text": "In the archive, one neat circular diagram sits beside a map of many water stores. Sable asks what the visitors should see next. Sable points to soil, plants and the atmosphere. Water has several stores and pathways, beyond the familiar three-arrow diagram.",
    "sourceRefs": [
     "river-water"
    ],
    "choices": [
     {
      "label": "Build a small demonstration",
      "consequence": "You move from the archive to the workshop.",
      "sourceRefs": [
       "river-water"
      ]
     },
     {
      "label": "Investigate the garden pathways",
      "consequence": "You follow the wider route instead of the rig.",
      "sourceRefs": [
       "river-water"
      ]
     }
    ]
   },
   {
    "title": "The demonstration",
    "speaker": "captain",
    "text": "The demonstration can make two opposite state changes visible. The crew can test once more together or commit to the public opening. The captain checks the labels: liquid to vapour is evaporation, while vapour to liquid is condensation. They are different processes.",
    "sourceRefs": [
     "river-water"
    ],
    "choices": [
     {
      "label": "Compare the crew’s findings",
      "consequence": "The captain joins before the final commitment.",
      "sourceRefs": [
       "river-water"
      ]
     },
     {
      "label": "Open the workshop tonight",
      "consequence": "You commit the crew and visitors to the public demonstration.",
      "sourceRefs": [
       "river-water"
      ]
     }
    ]
   },
   {
    "title": "The community route",
    "speaker": "engineer",
    "text": "The garden offers places to observe water entering soil and leaving plants. The crew can compare notes with the captain or reserve this quiet route. Water entering soil is infiltration. Water leaving plant leaves as vapour is transpiration. Nessa marks both routes on the sketch.",
    "sourceRefs": [
     "river-water"
    ],
    "choices": [
     {
      "label": "Bring the findings to the captain",
      "consequence": "A final conversation keeps both venues possible.",
      "sourceRefs": [
       "river-water"
      ]
     },
     {
      "label": "Reserve the garden study",
      "consequence": "You commit the crew to small-group observation.",
      "sourceRefs": [
       "river-water"
      ]
     }
    ]
   },
   {
    "title": "A final conversation",
    "speaker": "captain",
    "text": "The gathered notes now support either venue. Choose which promise Riverlight keeps tonight. The captain asks which idea visitors should explain afterwards: opposite state changes, or the wider set of pathways.",
    "sourceRefs": [
     "river-water"
    ],
    "choices": [
     {
      "label": "Open the public workshop",
      "consequence": "The lantern crowd gathers around the demonstration.",
      "sourceRefs": [
       "river-water"
      ]
     },
     {
      "label": "Keep the garden study",
      "consequence": "A smaller group follows the outdoor observation route.",
      "sourceRefs": [
       "river-water"
      ]
     }
    ]
   }
  ],
  "endings": [
   {
    "title": "The workshop opens",
    "text": "Visitors watch the crew demonstrate evaporation and condensation. The garden session waits for another evening.",
    "sourceRefs": [
     "river-water"
    ]
   },
   {
    "title": "The garden stays quiet",
    "text": "The crew leads close observation of plant and soil pathways. The large workshop event is postponed.",
    "sourceRefs": [
     "river-water"
    ]
   }
  ],
  "debrief": {
   "question": "What did your choice make possible, and what did it postpone?",
   "explanation": "Explain one concept using the source notes, then name the trade-off in the event you chose. Another route leads to another ending; neither event measures your mastery.",
   "sourceRefs": [
    "river-water"
   ]
  },
  "sources": [
   {
    "id": "river-water",
    "title": "Riverlight water notes — authored from NOAA",
    "locator": "Fluxes: How water moves; introductory model boundary",
    "excerpt": "Evaporation changes liquid water to vapour; condensation forms liquid from vapour. Transpiration releases water from plant leaves. Precipitation falls from the atmosphere; infiltration enters soil. Sublimation changes ice directly to vapour; deposition forms ice from vapour. Water is stored in several states and locations. Humans affect its storage and flow. A three-stage diagram represents only part of this complex cycle."
   }
  ]
 },
 {
  "schemaVersion": 1,
  "template": "novel-v1",
  "id": "riverlight-industrial-story",
  "topicId": "industrial-change",
  "revision": 1,
  "title": "The mill exhibition",
  "subtitle": "One evening. Two promises. Your decision.",
  "hook": "Help Riverlight choose how to share an idea. Your route changes the conversations and the event the town holds. The setting and characters are fictional; the source notes explain the real concepts.",
  "nodes": [
   {
    "title": "The evening ahead",
    "speaker": "archivist",
    "text": "Riverlight has one exhibition hall for the evening. Sable can begin with machinery records or the record of factory inspection. The curators have two evidence strands: machines increased textile production, while institutions developed powers to inspect factories.",
    "sourceRefs": [
     "river-machines",
     "river-inspectors"
    ],
    "choices": [
     {
      "label": "Begin with machine evidence",
      "consequence": "The engineering room receives the first preparation slot.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     },
     {
      "label": "Begin with inspection evidence",
      "consequence": "The civic archive receives the first preparation slot.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     }
    ]
   },
   {
    "title": "At the workshop",
    "speaker": "engineer",
    "text": "The engineering room explores evidence that powered textile machines increased production. The display must also make its limits clear. Nessa points to the museum record: powered machines could spin and weave more cotton. Increased output alone does not describe every experience of industrial change.",
    "sourceRefs": [
     "river-machines",
     "river-inspectors"
    ],
    "choices": [
     {
      "label": "Prepare a machinery demonstration",
      "consequence": "The crew moves to the engineering display.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     },
     {
      "label": "Bring the evidence to the civic table",
      "consequence": "The crew makes institutions the next focus.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     }
    ]
   },
   {
    "title": "Inside the archive",
    "speaker": "archivist",
    "text": "The civic archive records the creation of factory inspectors in 1833. The curators decide how to connect oversight with industrial change. The 1833 Act established four factory inspectors with powers to penalise infringements. Sable asks why institutional evidence belongs beside the machines.",
    "sourceRefs": [
     "river-machines",
     "river-inspectors"
    ],
    "choices": [
     {
      "label": "Connect oversight to the engineering display",
      "consequence": "The civic record follows you into the machine-led route.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     },
     {
      "label": "Prepare the inspection discussion",
      "consequence": "The civic discussion becomes the next scene.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     }
    ]
   },
   {
    "title": "The demonstration",
    "speaker": "captain",
    "text": "The engineering display is almost ready. The captain can invite a final comparison or open the machine-led exhibition now. The captain adds a note: a working machine can illustrate production, while the separate inspection record tells visitors about oversight.",
    "sourceRefs": [
     "river-machines",
     "river-inspectors"
    ],
    "choices": [
     {
      "label": "Compare both evidence strands",
      "consequence": "The final meeting can still redirect the event.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     },
     {
      "label": "Open the machine-led exhibition",
      "consequence": "The hall opens with technology, and the civic debate waits.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     }
    ]
   },
   {
    "title": "The community route",
    "speaker": "captain",
    "text": "The civic discussion is almost ready. The captain can consult the whole crew or commit the hall to questions about oversight. The discussion links machinery with the creation of inspectors. The two sources support different claims; neither is a complete history.",
    "sourceRefs": [
     "river-machines",
     "river-inspectors"
    ],
    "choices": [
     {
      "label": "Consult the whole crew",
      "consequence": "The final meeting can still choose either format.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     },
     {
      "label": "Host the civic discussion",
      "consequence": "The hall becomes a discussion space, and the demonstration waits.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     }
    ]
   },
   {
    "title": "A final conversation",
    "speaker": "archivist",
    "text": "Both evidence strands are available, but the hall can host only one leading format tonight. Choose the emphasis without pretending it tells the whole story. Sable keeps both source passages available. A chosen exhibition emphasis is a curatorial decision, not proof that one cause explains all industrial change.",
    "sourceRefs": [
     "river-machines",
     "river-inspectors"
    ],
    "choices": [
     {
      "label": "Lead with machines and context",
      "consequence": "The crew presents the machinery evidence with its limitations.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     },
     {
      "label": "Lead with oversight and context",
      "consequence": "The crew presents the institutional evidence with its limitations.",
      "sourceRefs": [
       "river-machines",
       "river-inspectors"
      ]
     }
    ]
   }
  ],
  "endings": [
   {
    "title": "Machines in context",
    "text": "The hall hosts the demonstration; visitors receive the inspection record as a companion reading. A discussion event is deferred.",
    "sourceRefs": [
     "river-machines",
     "river-inspectors"
    ]
   },
   {
    "title": "Oversight in context",
    "text": "The hall hosts a discussion; visitors receive the machinery record as a companion reading. The demonstration is deferred.",
    "sourceRefs": [
     "river-machines",
     "river-inspectors"
    ]
   }
  ],
  "debrief": {
   "question": "What did your choice make possible, and what did it postpone?",
   "explanation": "Explain one concept using the source notes, then name the trade-off in the event you chose. Another route leads to another ending; neither event measures your mastery.",
   "sourceRefs": [
    "river-machines",
    "river-inspectors"
   ]
  },
  "sources": [
   {
    "id": "river-inspectors",
    "title": "UK Parliament — The 1833 Factory Act",
    "locator": "Factory Inspectors",
    "excerpt": "The 1833 Act established four factory inspectors, reporting to the Home Office, with powers to penalise infringements. The game uses this institutional change alongside machinery evidence; its Riverlight characters, exhibition and choices are invented, not historical testimony."
   },
   {
    "id": "river-machines",
    "title": "Science Museum Group — Textiles Gallery",
    "locator": "PDF page 3, Makers and machines",
    "excerpt": "powered machines that could spin and weave more cotton than ever before."
   }
  ]
 },
 {
  "schemaVersion": 1,
  "template": "quiz-v1",
  "id": "riverlight-water-quiz",
  "topicId": "water-cycle",
  "revision": 1,
  "title": "Water on the move",
  "subtitle": "Connect eight ideas in the night sky.",
  "hook": "The observatory is missing eight connections. Investigate each question, use feedback and reconnect the constellation at your own pace. The stars are fictional scenery; the concepts come from the source notes.",
  "questions": [
   {
    "prompt": "Liquid becomes vapour. Name the change.",
    "options": [
     {
      "label": "Evaporation",
      "feedback": "Liquid → vapour."
     },
     {
      "label": "Condensation",
      "feedback": "Condensation runs in the reverse direction."
     },
     {
      "label": "Freezing",
      "feedback": "Freezing produces solid water."
     }
    ],
    "solution": 0,
    "explanation": "Liquid → vapour. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-water"
    ]
   },
   {
    "prompt": "Vapour forms droplets. Which process fits?",
    "options": [
     {
      "label": "Runoff",
      "feedback": "Runoff describes surface movement."
     },
     {
      "label": "Condensation",
      "feedback": "Vapour → liquid."
     },
     {
      "label": "Evaporation",
      "feedback": "Evaporation starts with liquid."
     }
    ],
    "solution": 1,
    "explanation": "Vapour → liquid. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-water"
    ]
   },
   {
    "prompt": "Rainwater enters the soil. What is this?",
    "options": [
     {
      "label": "Precipitation",
      "feedback": "The rain has already landed."
     },
     {
      "label": "Transpiration",
      "feedback": "Look for plants releasing water."
     },
     {
      "label": "Infiltration",
      "feedback": "Water enters soil."
     }
    ],
    "solution": 2,
    "explanation": "Water enters soil. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-water"
    ]
   },
   {
    "prompt": "Which stored water is solid?",
    "options": [
     {
      "label": "Glacier ice",
      "feedback": "Ice is solid."
     },
     {
      "label": "River water",
      "feedback": "River water here is liquid."
     },
     {
      "label": "Water vapour",
      "feedback": "Vapour is gaseous."
     }
    ],
    "solution": 0,
    "explanation": "Ice is solid. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-water"
    ]
   },
   {
    "prompt": "Rain falls from a cloud. Choose the process.",
    "options": [
     {
      "label": "Infiltration",
      "feedback": "That happens at the soil."
     },
     {
      "label": "Precipitation",
      "feedback": "Water falls from the atmosphere."
     },
     {
      "label": "Sublimation",
      "feedback": "That begins with ice or snow."
     }
    ],
    "solution": 1,
    "explanation": "Water falls from the atmosphere. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-water"
    ]
   },
   {
    "prompt": "Water leaves a plant as vapour. Name the process.",
    "options": [
     {
      "label": "Deposition",
      "feedback": "Deposition forms ice."
     },
     {
      "label": "Runoff",
      "feedback": "Runoff flows over surfaces."
     },
     {
      "label": "Transpiration",
      "feedback": "Water exits plant leaves."
     }
    ],
    "solution": 2,
    "explanation": "Water exits plant leaves. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-water"
    ]
   },
   {
    "prompt": "On a cold dry day, a small ice sample shrinks directly into vapour without a puddle. Which change explains the observation?",
    "options": [
     {
      "label": "Sublimation",
      "feedback": "Solid → vapour."
     },
     {
      "label": "Condensation",
      "feedback": "Condensation produces liquid."
     },
     {
      "label": "Infiltration",
      "feedback": "Infiltration enters soil."
     }
    ],
    "solution": 0,
    "explanation": "Solid → vapour. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-water"
    ]
   },
   {
    "prompt": "A class diagram shows only evaporation, condensation and rain. A learner adds water entering soil. How should the original diagram be described?",
    "options": [
     {
      "label": "Every possible water pathway",
      "feedback": "It leaves out many pathways."
     },
     {
      "label": "A useful simplified model",
      "feedback": "The real system has more routes."
     },
     {
      "label": "Proof humans never affect water",
      "feedback": "Humans also affect storage and flow."
     }
    ],
    "solution": 1,
    "explanation": "The real system has more routes. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-water"
    ]
   }
  ],
  "debrief": {
   "question": "Where would you use one of these ideas in a new situation?",
   "explanation": "Choose a connection you revisited, explain the correct relationship in your own words and check it against the source. Your first-attempt record describes this run only.",
   "sourceRefs": [
    "river-water"
   ]
  },
  "sources": [
   {
    "id": "river-water",
    "title": "Riverlight water notes — authored from NOAA",
    "locator": "Fluxes: How water moves; introductory model boundary",
    "excerpt": "Evaporation changes liquid water to vapour; condensation forms liquid from vapour. Transpiration releases water from plant leaves. Precipitation falls from the atmosphere; infiltration enters soil. Sublimation changes ice directly to vapour; deposition forms ice from vapour. Water is stored in several states and locations. Humans affect its storage and flow. A three-stage diagram represents only part of this complex cycle."
   }
  ]
 },
 {
  "schemaVersion": 1,
  "template": "quiz-v1",
  "id": "riverlight-web-quiz",
  "topicId": "food-webs",
  "revision": 1,
  "title": "Who feeds whom?",
  "subtitle": "Connect eight ideas in the night sky.",
  "hook": "The observatory is missing eight connections. Investigate each question, use feedback and reconnect the constellation at your own pace. The stars are fictional scenery; the concepts come from the source notes.",
  "questions": [
   {
    "prompt": "Which process lets plants make food using light?",
    "options": [
     {
      "label": "Photosynthesis",
      "feedback": "Light supports food production."
     },
     {
      "label": "Hunting",
      "feedback": "That obtains other organisms as food."
     },
     {
      "label": "Decomposition",
      "feedback": "That breaks down remains."
     }
    ],
    "solution": 0,
    "explanation": "Light supports food production. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "A food-web arrow points…",
    "options": [
     {
      "label": "Toward the nearest habitat",
      "feedback": "Distance is not its meaning."
     },
     {
      "label": "Always toward a plant",
      "feedback": "Follow feeding, not appearance."
     },
     {
      "label": "From food to eater",
      "feedback": "It follows energy transfer."
     }
    ],
    "solution": 2,
    "explanation": "It follows energy transfer. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "Primary consumers eat…",
    "options": [
     {
      "label": "Only secondary consumers",
      "feedback": "Check the level below them."
     },
     {
      "label": "Producers",
      "feedback": "They feed on producers."
     },
     {
      "label": "Nothing",
      "feedback": "Consumers obtain food."
     }
    ],
    "solution": 1,
    "explanation": "They feed on producers. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "Secondary consumers feed on…",
    "options": [
     {
      "label": "Primary consumers",
      "feedback": "They eat primary consumers."
     },
     {
      "label": "Sunlight alone",
      "feedback": "That does not describe a consumer."
     },
     {
      "label": "Only soil",
      "feedback": "Identify a feeding relationship."
     }
    ],
    "solution": 0,
    "explanation": "They eat primary consumers. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "An omnivore eats…",
    "options": [
     {
      "label": "Plants only",
      "feedback": "That is not the full category."
     },
     {
      "label": "Animals only",
      "feedback": "That is not the full category."
     },
     {
      "label": "Plants and animals",
      "feedback": "Both groups supply food."
     }
    ],
    "solution": 2,
    "explanation": "Both groups supply food. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "Decomposition can return…",
    "options": [
     {
      "label": "New sunlight",
      "feedback": "Sunlight is not made this way."
     },
     {
      "label": "Nutrients to producers",
      "feedback": "Nutrients become available again."
     },
     {
      "label": "Nothing useful",
      "feedback": "Consider nutrient cycling."
     }
    ],
    "solution": 1,
    "explanation": "Nutrients become available again. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "An exhibition links grass to a grazer, and the grazer to two predators. What does this branching display represent?",
    "options": [
     {
      "label": "Connected feeding relationships",
      "feedback": "Several relationships can overlap."
     },
     {
      "label": "One compulsory straight line",
      "feedback": "A web can branch."
     },
     {
      "label": "Sporting positions",
      "feedback": "The sports theme is separate."
     }
    ],
    "solution": 0,
    "explanation": "Several relationships can overlap. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "A grazer disappears from the exhibition’s ecosystem. What can you reasonably infer about organisms connected to it?",
    "options": [
     {
      "label": "Never affect others",
      "feedback": "Relationships connect populations."
     },
     {
      "label": "Guarantee every species disappears",
      "feedback": "That conclusion is too absolute."
     },
     {
      "label": "Affect connected organisms",
      "feedback": "Effects may spread through connections."
     }
    ],
    "solution": 2,
    "explanation": "Effects may spread through connections. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   }
  ],
  "debrief": {
   "question": "Where would you use one of these ideas in a new situation?",
   "explanation": "Choose a connection you revisited, explain the correct relationship in your own words and check it against the source. Your first-attempt record describes this run only.",
   "sourceRefs": [
    "river-foodweb"
   ]
  },
  "sources": [
   {
    "id": "river-foodweb",
    "title": "Riverlight food-web notes — authored from NOAA",
    "locator": "What is a food web?; Producers; Consumers",
    "excerpt": "Photosynthesis lets plants make food using light. Primary consumers eat producers; secondary consumers eat primary consumers. Omnivores eat plants and animals. Food-web arrows follow energy from food to eater. Webs show connected feeding relationships; changes can affect other organisms. Decomposition returns nutrients to producers. Study-card combinations below assemble representations, not living organisms."
   }
  ]
 },
 {
  "schemaVersion": 1,
  "template": "sports-v1",
  "id": "riverlight-fraction-cup",
  "topicId": "fraction-arithmetic",
  "revision": 1,
  "title": "The fractions cup",
  "subtitle": "Six possessions. Think, move, take your shot.",
  "hook": "A turn-based football match with a learning huddle before each possession. The knowledge questions and fictional match tactics are separate: first-attempt insight gives a small shot bonus, while corrected answers still let you play.",
  "teamName": "Riverlight",
  "opponentName": "Harbour Athletic",
  "questions": [
   {
    "prompt": "On the same track: 1/4 + 2/4 = ?",
    "options": [
     {
      "label": "3/8",
      "feedback": "Keep the equal part size."
     },
     {
      "label": "3/4",
      "feedback": "Three quarter-lengths."
     },
     {
      "label": "2/4",
      "feedback": "Count both contributions."
     }
    ],
    "solution": 1,
    "explanation": "Three quarter-lengths. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "prompt": "Same whole: 1/8 + 3/8 = ?",
    "options": [
     {
      "label": "1/2",
      "feedback": "Four eighths is one half."
     },
     {
      "label": "4/16",
      "feedback": "Do not add denominators."
     },
     {
      "label": "3/8",
      "feedback": "Include the first eighth."
     }
    ],
    "solution": 0,
    "explanation": "Four eighths is one half. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "prompt": "A 5/6 route loses 2/6. Remaining distance?",
    "options": [
     {
      "label": "3/12",
      "feedback": "The part size stays sixths."
     },
     {
      "label": "7/6",
      "feedback": "The action removes distance."
     },
     {
      "label": "1/2",
      "feedback": "Three sixths remains."
     }
    ],
    "solution": 2,
    "explanation": "Three sixths remains. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "prompt": "Same whole: 2/8 + 5/8 = ?",
    "options": [
     {
      "label": "7/8",
      "feedback": "Seven eighths."
     },
     {
      "label": "7/16",
      "feedback": "The pieces stay eighths."
     },
     {
      "label": "3/8",
      "feedback": "This is addition."
     }
    ],
    "solution": 0,
    "explanation": "Seven eighths. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "prompt": "Two straight, non-overlapping passes each cover 3/10 of the same pitch length. Together they cover…",
    "options": [
     {
      "label": "6/20",
      "feedback": "Denominators name piece size."
     },
     {
      "label": "3/5",
      "feedback": "Six tenths simplifies to three fifths."
     },
     {
      "label": "9/10",
      "feedback": "Count two passes."
     }
    ],
    "solution": 1,
    "explanation": "Six tenths simplifies to three fifths. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "prompt": "Adding common-denominator fractions keeps the…",
    "options": [
     {
      "label": "Numerator unchanged",
      "feedback": "The count can change."
     },
     {
      "label": "Number of terms unchanged",
      "feedback": "The result is a sum."
     },
     {
      "label": "Size of each part unchanged",
      "feedback": "The denominator stays fixed."
     }
    ],
    "solution": 2,
    "explanation": "The denominator stays fixed. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-fractions"
    ]
   }
  ],
  "debrief": {
   "question": "Which idea needed another look, and which tactical choice helped your team?",
   "explanation": "Explain the learning idea from its source, then discuss lane choice and stamina separately. A match score reflects fictional tactics and is not a measure of subject knowledge.",
   "sourceRefs": [
    "river-fractions"
   ]
  },
  "sources": [
   {
    "id": "river-fractions",
    "title": "Riverlight fraction notes — authored from OpenStax",
    "locator": "Add Fractions with a Common Denominator",
    "excerpt": "When fractions describe equal-sized parts of the same whole, add or subtract their numerators and retain the common denominator. Simplify the result when possible. The denominator identifies the size of each part; the numerator counts parts. All game quantities must name the same unit and whole before combination."
   }
  ]
 },
 {
  "schemaVersion": 1,
  "template": "sports-v1",
  "id": "riverlight-ecology-cup",
  "topicId": "food-webs",
  "revision": 1,
  "title": "The food-web cup",
  "subtitle": "Six possessions. Think, move, take your shot.",
  "hook": "A turn-based football match with a learning huddle before each possession. The knowledge questions and fictional match tactics are separate: first-attempt insight gives a small shot bonus, while corrected answers still let you play.",
  "teamName": "Riverlight",
  "opponentName": "Harbour Athletic",
  "questions": [
   {
    "prompt": "Which process lets plants make food using light?",
    "options": [
     {
      "label": "Photosynthesis",
      "feedback": "Light supports food production."
     },
     {
      "label": "Hunting",
      "feedback": "That obtains other organisms as food."
     },
     {
      "label": "Decomposition",
      "feedback": "That breaks down remains."
     }
    ],
    "solution": 0,
    "explanation": "Light supports food production. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "A food-web arrow points…",
    "options": [
     {
      "label": "Toward the nearest habitat",
      "feedback": "Distance is not its meaning."
     },
     {
      "label": "Always toward a plant",
      "feedback": "Follow feeding, not appearance."
     },
     {
      "label": "From food to eater",
      "feedback": "It follows energy transfer."
     }
    ],
    "solution": 2,
    "explanation": "It follows energy transfer. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "Primary consumers eat…",
    "options": [
     {
      "label": "Only secondary consumers",
      "feedback": "Check the level below them."
     },
     {
      "label": "Producers",
      "feedback": "They feed on producers."
     },
     {
      "label": "Nothing",
      "feedback": "Consumers obtain food."
     }
    ],
    "solution": 1,
    "explanation": "They feed on producers. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "Secondary consumers feed on…",
    "options": [
     {
      "label": "Primary consumers",
      "feedback": "They eat primary consumers."
     },
     {
      "label": "Sunlight alone",
      "feedback": "That does not describe a consumer."
     },
     {
      "label": "Only soil",
      "feedback": "Identify a feeding relationship."
     }
    ],
    "solution": 0,
    "explanation": "They eat primary consumers. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "An omnivore eats…",
    "options": [
     {
      "label": "Plants only",
      "feedback": "That is not the full category."
     },
     {
      "label": "Animals only",
      "feedback": "That is not the full category."
     },
     {
      "label": "Plants and animals",
      "feedback": "Both groups supply food."
     }
    ],
    "solution": 2,
    "explanation": "Both groups supply food. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "prompt": "Decomposition can return…",
    "options": [
     {
      "label": "New sunlight",
      "feedback": "Sunlight is not made this way."
     },
     {
      "label": "Nutrients to producers",
      "feedback": "Nutrients become available again."
     },
     {
      "label": "Nothing useful",
      "feedback": "Consider nutrient cycling."
     }
    ],
    "solution": 1,
    "explanation": "Nutrients become available again. The supporting passage explains the relationship; use it to check the reasoning, not just the answer word.",
    "sourceRefs": [
     "river-foodweb"
    ]
   }
  ],
  "debrief": {
   "question": "Which idea needed another look, and which tactical choice helped your team?",
   "explanation": "Explain the learning idea from its source, then discuss lane choice and stamina separately. A match score reflects fictional tactics and is not a measure of subject knowledge.",
   "sourceRefs": [
    "river-foodweb"
   ]
  },
  "sources": [
   {
    "id": "river-foodweb",
    "title": "Riverlight food-web notes — authored from NOAA",
    "locator": "What is a food web?; Producers; Consumers",
    "excerpt": "Photosynthesis lets plants make food using light. Primary consumers eat producers; secondary consumers eat primary consumers. Omnivores eat plants and animals. Food-web arrows follow energy from food to eater. Webs show connected feeding relationships; changes can affect other organisms. Decomposition returns nutrients to producers. Study-card combinations below assemble representations, not living organisms."
   }
  ]
 },
 {
  "schemaVersion": 1,
  "template": "merge-v1",
  "id": "riverlight-fraction-workshop",
  "topicId": "fraction-addition",
  "revision": 1,
  "title": "The festival portions",
  "subtitle": "A workbench of ideas. Three town commissions.",
  "hook": "All tokens describe portions of the same standard loaf. Art is a token marker, not the physical ingredient. Collect the two base tokens, follow the recipe journal and deliver the requested pieces. The illustrations are reusable symbols.",
  "items": [
   {
    "name": "One eighth",
    "description": "1/8 of one standard loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "name": "One quarter",
    "description": "1/4 of one standard loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "name": "Three eighths",
    "description": "3/8 of one standard loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "name": "One half",
    "description": "1/2 of one standard loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "name": "Five eighths",
    "description": "5/8 of one standard loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "name": "Three quarters",
    "description": "3/4 of one standard loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "name": "Seven eighths",
    "description": "7/8 of one standard loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "name": "One whole",
    "description": "1 of one standard loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   }
  ],
  "recipes": [
   {
    "inputs": [
     0,
     1
    ],
    "explanation": "1/8 + 1/4 = 3/8 of the same loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "inputs": [
     1,
     1
    ],
    "explanation": "1/4 + 1/4 = 1/2 of the same loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "inputs": [
     0,
     3
    ],
    "explanation": "1/8 + 1/2 = 5/8 of the same loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "inputs": [
     1,
     3
    ],
    "explanation": "1/4 + 1/2 = 3/4 of the same loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "inputs": [
     0,
     5
    ],
    "explanation": "1/8 + 3/4 = 7/8 of the same loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "inputs": [
     1,
     5
    ],
    "explanation": "1/4 + 3/4 = 1 of the same loaf.",
    "sourceRefs": [
     "river-fractions"
    ]
   }
  ],
  "orders": [
   {
    "title": "The first commission",
    "item": 2,
    "quantity": 1,
    "purpose": "Prepare 1 × three eighths for the guild display. Explain the connection before handing it over.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "title": "The exhibition piece",
    "item": 5,
    "quantity": 1,
    "purpose": "Prepare 1 × three quarters for the guild display. Explain the connection before handing it over.",
    "sourceRefs": [
     "river-fractions"
    ]
   },
   {
    "title": "The closing commission",
    "item": 7,
    "quantity": 1,
    "purpose": "Prepare 1 × one whole for the guild display. Explain the connection before handing it over.",
    "sourceRefs": [
     "river-fractions"
    ]
   }
  ],
  "debrief": {
   "question": "What does one of your combinations represent?",
   "explanation": "Describe the relationship in a recipe using the source notes. In fraction work, keep the same whole and part size clear; in a study display, assembling cards is an analogy rather than a physical transformation.",
   "sourceRefs": [
    "river-fractions"
   ]
  },
  "sources": [
   {
    "id": "river-fractions",
    "title": "Riverlight fraction notes — authored from OpenStax",
    "locator": "Add Fractions with a Common Denominator",
    "excerpt": "When fractions describe equal-sized parts of the same whole, add or subtract their numerators and retain the common denominator. Simplify the result when possible. The denominator identifies the size of each part; the numerator counts parts. All game quantities must name the same unit and whole before combination."
   }
  ]
 },
 {
  "schemaVersion": 1,
  "template": "merge-v1",
  "id": "riverlight-web-workshop",
  "topicId": "food-web-models",
  "revision": 1,
  "title": "Build the food-web exhibition",
  "subtitle": "A workbench of ideas. Three town commissions.",
  "hook": "These are conceptual assemblies of reviewed study cards, not biological growth or chemical reactions. Repeated notes are not independent corroborating sources. Collect the two base tokens, follow the recipe journal and deliver the requested pieces. The illustrations are reusable symbols.",
  "items": [
   {
    "name": "Producer note",
    "description": "A reusable study card about producers.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "name": "Consumer note",
    "description": "A reusable study card about consumers.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "name": "Feeding-link panel",
    "description": "A representation of food moving to an eater.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "name": "Producer panel",
    "description": "A display comparing producer examples.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "name": "Consumer-role panel",
    "description": "A display comparing consumer roles.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "name": "Chain-study panel",
    "description": "A representation of a feeding route.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "name": "Web-study panel",
    "description": "A study display connecting feeding routes.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "name": "Annotated web display",
    "description": "The web display with producer context.",
    "sourceRefs": [
     "river-foodweb"
    ]
   }
  ],
  "recipes": [
   {
    "inputs": [
     0,
     1
    ],
    "explanation": "Connect producer and consumer notes. A producer makes its own food; a primary consumer eats a producer. The link follows energy from food to eater.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "inputs": [
     0,
     0
    ],
    "explanation": "Group producer examples for comparison. Producers use light in photosynthesis. Repeating a study card is a display choice, not independent evidence.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "inputs": [
     1,
     1
    ],
    "explanation": "Group consumer roles for comparison. Primary consumers eat producers; secondary consumers eat primary consumers. Compare those roles.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "inputs": [
     2,
     4
    ],
    "explanation": "Extend the represented feeding route. A represented route can connect producers, primary consumers and secondary consumers. It is a model, not a living organism.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "inputs": [
     5,
     2
    ],
    "explanation": "Connect represented routes into a web. Several feeding routes can overlap. A web shows more connections than a single chain.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "inputs": [
     6,
     3
    ],
    "explanation": "Add producer context to the display. Producers supply food at the beginning of many feeding routes. Include that context when annotating the web.",
    "sourceRefs": [
     "river-foodweb"
    ]
   }
  ],
  "orders": [
   {
    "title": "The first commission",
    "item": 2,
    "quantity": 1,
    "purpose": "Prepare 1 × feeding-link panel for the guild display. Explain the connection before handing it over.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "title": "The exhibition piece",
    "item": 6,
    "quantity": 1,
    "purpose": "Prepare 1 × web-study panel for the guild display. Explain the connection before handing it over.",
    "sourceRefs": [
     "river-foodweb"
    ]
   },
   {
    "title": "The closing commission",
    "item": 7,
    "quantity": 1,
    "purpose": "Prepare 1 × annotated web display for the guild display. Explain the connection before handing it over.",
    "sourceRefs": [
     "river-foodweb"
    ]
   }
  ],
  "debrief": {
   "question": "What does one of your combinations represent?",
   "explanation": "Describe the relationship in a recipe using the source notes. In fraction work, keep the same whole and part size clear; in a study display, assembling cards is an analogy rather than a physical transformation.",
   "sourceRefs": [
    "river-foodweb"
   ]
  },
  "sources": [
   {
    "id": "river-foodweb",
    "title": "Riverlight food-web notes — authored from NOAA",
    "locator": "What is a food web?; Producers; Consumers",
    "excerpt": "Photosynthesis lets plants make food using light. Primary consumers eat producers; secondary consumers eat primary consumers. Omnivores eat plants and animals. Food-web arrows follow energy from food to eater. Webs show connected feeding relationships; changes can affect other organisms. Decomposition returns nutrients to producers. Study-card combinations below assemble representations, not living organisms."
   }
  ]
 }
];
export const EXTENDED_PACKS=raw.map(validateExtendedContent);
