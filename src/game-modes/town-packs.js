import {validateTownContent} from './town-content.js';
const raw=[
 {
  "schemaVersion": 1,
  "template": "town-v1",
  "revision": 1,
  "buildings": [
   {
    "id": "home",
    "name": "Home",
    "purpose": "The fictional town supplies a small monthly civic income. Track this separately from sales so that receipts from different sources are visible.",
    "sourceRefs": [
     "town-business-breakeven"
    ]
   },
   {
    "id": "workshop",
    "name": "Workshop",
    "purpose": "Making goods and selling goods are separate steps. Capacity is useful only when the town can use or sell its output.",
    "sourceRefs": [
     "town-business-costs"
    ]
   },
   {
    "id": "market",
    "name": "Market",
    "purpose": "Compare sales revenue with all operating costs. Revenue on its own does not show whether a plan covers its costs.",
    "sourceRefs": [
     "town-business-breakeven"
    ]
   },
   {
    "id": "warehouse",
    "name": "Storehouse",
    "purpose": "An additional building creates an ongoing cost as well as an initial payment. Compare the benefit of more storage with its upkeep.",
    "sourceRefs": [
     "town-business-costs"
    ]
   },
   {
    "id": "school",
    "name": "School",
    "purpose": "This fictional service has an initial construction payment and continuing monthly upkeep. Reserving funds for ongoing work is part of the plan.",
    "sourceRefs": [
     "town-business-costs"
    ]
   },
   {
    "id": "clinic",
    "name": "Clinic",
    "purpose": "A service can be useful while still needing an operating budget. The service-radius rule is a game assumption, not a claim about real healthcare.",
    "sourceRefs": [
     "town-business-costs"
    ]
   },
   {
    "id": "garden",
    "name": "Garden",
    "purpose": "Green infrastructure can slow and temporarily store runoff. In this game, the nature index stands in for several environmental pressures.",
    "sourceRefs": [
     "town-water-benefits"
    ]
   },
   {
    "id": "water",
    "name": "Water store",
    "purpose": "Real green infrastructure needs suitable conditions and continuing maintenance. This game simplifies those requirements into a location rule and upkeep.",
    "sourceRefs": [
     "town-water-maintenance"
    ]
   }
  ],
  "events": [
   {
    "title": "An invitation to the market",
    "prompt": "The traders propose a short promotion. More demand will help only if you have goods and market capacity. Compare the next-month ledger before deciding.",
    "choices": [
     {
      "label": "Fund the promotion",
      "explanation": "The additional demand is a fictional scenario assumption. Costs must still be covered; producing or attracting demand alone does not guarantee a surplus.",
      "sourceRefs": [
       "town-business-breakeven",
       "town-business-costs"
      ]
     },
     {
      "label": "Keep the reserve",
      "explanation": "Keeping cash leaves more room for future expenses. In this model it also leaves demand unchanged; compare revenue with costs.",
      "sourceRefs": [
       "town-business-breakeven"
      ]
     }
    ]
   },
   {
    "title": "The upkeep ledger",
    "prompt": "The grounds team requests a maintenance payment. The new works need continuing attention as well as their original construction budget.",
    "choices": [
     {
      "label": "Fund the maintenance",
      "explanation": "EPA describes continuing inspection, repair and plant care. This payment and the nature change are game values, not estimates of real maintenance costs.",
      "sourceRefs": [
       "town-water-maintenance"
      ]
     },
     {
      "label": "Defer the work",
      "explanation": "Deferring saves cash now. In this simplified game nature falls; real maintenance needs depend on the particular installation.",
      "sourceRefs": [
       "town-water-maintenance"
      ]
     }
    ]
   },
   {
    "title": "Rain over the river",
    "prompt": "The council can prepare drainage and planting before rain arrives. The nature index is an abstract teaching measure; it does not predict flooding.",
    "choices": [
     {
      "label": "Prepare the green spaces",
      "explanation": "Green infrastructure can capture or slow runoff. Suitable systems and site conditions matter; the game’s benefit is an authored abstraction.",
      "sourceRefs": [
       "town-water-benefits"
      ]
     },
     {
      "label": "Defer the repairs",
      "explanation": "This leaves funds for other needs but lowers the fictional nature index. It is not a claim that the same real-world choice has a fixed environmental effect.",
      "sourceRefs": [
       "town-water-benefits",
       "town-water-maintenance"
      ]
     }
    ]
   },
   {
    "title": "People behind the services",
    "prompt": "The council proposes a shared maintenance workshop for staff. Consider the cost beside the town’s service goal.",
    "choices": [
     {
      "label": "Fund shared training",
      "explanation": "EPA emphasises responsible staff and dedicated maintenance funding. The permanent service points are a game simplification, not a measure of learning or staff competence.",
      "sourceRefs": [
       "town-water-maintenance"
      ]
     },
     {
      "label": "Keep funds for next year",
      "explanation": "Keeping a reserve protects the budget, but does not add service points in this scenario. Ongoing work still needs a funding plan.",
      "sourceRefs": [
       "town-water-maintenance"
      ]
     }
    ]
   }
  ],
  "sources": [
   {
    "id": "town-business-breakeven",
    "title": "SBA — Plan your business",
    "locator": "Paraphrased research notes · Break-even point; Tips and tricks",
    "excerpt": "A business breaks even when its total revenue equals its total costs. For one product, the unit break-even estimate divides fixed costs by selling price minus variable cost per unit. SBA presents this as a planning estimate, not an exact prediction of future accounting results."
   },
   {
    "id": "town-business-costs",
    "title": "SBA — Break-even point calculator",
    "locator": "Paraphrased research notes · Calculate your total fixed costs; Calculate your total variable costs per unit",
    "excerpt": "Fixed costs are tied to a time period and do not change with sales volume within the stated model. Variable costs change with the number of units produced. The calculator asks separately for expected sales, selling price, fixed costs and variable cost per unit. Some real costs combine fixed and variable components."
   },
   {
    "id": "town-water-benefits",
    "title": "US EPA — Environmental Benefits of Green Infrastructure",
    "locator": "Paraphrased research notes · Improves Water Quality; Reduces Localized Flooding; Captures Water for Reuse",
    "excerpt": "Runoff from sealed surfaces can transport pollutants. Green infrastructure can capture water and filter pollutants, and slow or temporarily store runoff from small, frequent storms. Suitable systems can collect rainwater for irrigation. Infiltration depends on site conditions. These functions reduce some pressures on drainage; they are not a promise of zero flooding."
   },
   {
    "id": "town-water-maintenance",
    "title": "US EPA — Green Infrastructure Installation, Operation, and Maintenance",
    "locator": "Paraphrased research notes · Operation and Maintenance; Secure Funding for Maintenance",
    "excerpt": "Green infrastructure needs appropriate installation, inspection and continuing maintenance to function as intended. Work may include clearing sediment and debris, caring for plants and repairing damage. Public assets typically need a municipal maintenance plan, responsible staff and dedicated funding for ongoing work. Tasks and equipment depend on the particular installation."
   }
  ],
  "id": "living-town-market-town",
  "topicId": "market-town",
  "title": "Market Town",
  "subtitle": "Enterprise · costs, capacity and demand",
  "focus": "enterprise",
  "hook": "The riverside market is reopening. Build a connected town, support its residents and leave enough in the treasury for next year. A busy workshop is only one part of a viable plan.",
  "ending": "A town is a connected system. Your record shows what changed after each decision. Explain a trade-off using the ledger and the source notes, then rebuild and compare another approach. Completing the game is not a measure of mastery.",
  "debrief": {
   "question": "Which investment improved your monthly operating balance, and which cost was easy to overlook?",
   "explanation": "Distinguish a one-time construction payment from ongoing upkeep. Then explain the conceptual lesson using the sources. Income, demand, staffing, service radius and the nature index are authored game rules; they are not real forecasts.",
   "sourceRefs": [
    "town-business-breakeven",
    "town-business-costs",
    "town-water-benefits",
    "town-water-maintenance"
   ]
  }
 },
 {
  "schemaVersion": 1,
  "template": "town-v1",
  "revision": 1,
  "buildings": [
   {
    "id": "home",
    "name": "Home",
    "purpose": "The fictional town supplies a small monthly civic income. Track this separately from sales so that receipts from different sources are visible.",
    "sourceRefs": [
     "town-business-breakeven"
    ]
   },
   {
    "id": "workshop",
    "name": "Workshop",
    "purpose": "Making goods and selling goods are separate steps. Capacity is useful only when the town can use or sell its output.",
    "sourceRefs": [
     "town-business-costs"
    ]
   },
   {
    "id": "market",
    "name": "Market",
    "purpose": "Compare sales revenue with all operating costs. Revenue on its own does not show whether a plan covers its costs.",
    "sourceRefs": [
     "town-business-breakeven"
    ]
   },
   {
    "id": "warehouse",
    "name": "Storehouse",
    "purpose": "An additional building creates an ongoing cost as well as an initial payment. Compare the benefit of more storage with its upkeep.",
    "sourceRefs": [
     "town-business-costs"
    ]
   },
   {
    "id": "school",
    "name": "School",
    "purpose": "This fictional service has an initial construction payment and continuing monthly upkeep. Reserving funds for ongoing work is part of the plan.",
    "sourceRefs": [
     "town-business-costs"
    ]
   },
   {
    "id": "clinic",
    "name": "Clinic",
    "purpose": "A service can be useful while still needing an operating budget. The service-radius rule is a game assumption, not a claim about real healthcare.",
    "sourceRefs": [
     "town-business-costs"
    ]
   },
   {
    "id": "garden",
    "name": "Garden",
    "purpose": "Green infrastructure can slow and temporarily store runoff. In this game, the nature index stands in for several environmental pressures.",
    "sourceRefs": [
     "town-water-benefits"
    ]
   },
   {
    "id": "water",
    "name": "Water store",
    "purpose": "Real green infrastructure needs suitable conditions and continuing maintenance. This game simplifies those requirements into a location rule and upkeep.",
    "sourceRefs": [
     "town-water-maintenance"
    ]
   }
  ],
  "events": [
   {
    "title": "An invitation to the market",
    "prompt": "The traders propose a short promotion. More demand will help only if you have goods and market capacity. Compare the next-month ledger before deciding.",
    "choices": [
     {
      "label": "Fund the promotion",
      "explanation": "The additional demand is a fictional scenario assumption. Costs must still be covered; producing or attracting demand alone does not guarantee a surplus.",
      "sourceRefs": [
       "town-business-breakeven",
       "town-business-costs"
      ]
     },
     {
      "label": "Keep the reserve",
      "explanation": "Keeping cash leaves more room for future expenses. In this model it also leaves demand unchanged; compare revenue with costs.",
      "sourceRefs": [
       "town-business-breakeven"
      ]
     }
    ]
   },
   {
    "title": "The upkeep ledger",
    "prompt": "The grounds team requests a maintenance payment. The new works need continuing attention as well as their original construction budget.",
    "choices": [
     {
      "label": "Fund the maintenance",
      "explanation": "EPA describes continuing inspection, repair and plant care. This payment and the nature change are game values, not estimates of real maintenance costs.",
      "sourceRefs": [
       "town-water-maintenance"
      ]
     },
     {
      "label": "Defer the work",
      "explanation": "Deferring saves cash now. In this simplified game nature falls; real maintenance needs depend on the particular installation.",
      "sourceRefs": [
       "town-water-maintenance"
      ]
     }
    ]
   },
   {
    "title": "Rain over the river",
    "prompt": "The council can prepare drainage and planting before rain arrives. The nature index is an abstract teaching measure; it does not predict flooding.",
    "choices": [
     {
      "label": "Prepare the green spaces",
      "explanation": "Green infrastructure can capture or slow runoff. Suitable systems and site conditions matter; the game’s benefit is an authored abstraction.",
      "sourceRefs": [
       "town-water-benefits"
      ]
     },
     {
      "label": "Defer the repairs",
      "explanation": "This leaves funds for other needs but lowers the fictional nature index. It is not a claim that the same real-world choice has a fixed environmental effect.",
      "sourceRefs": [
       "town-water-benefits",
       "town-water-maintenance"
      ]
     }
    ]
   },
   {
    "title": "People behind the services",
    "prompt": "The council proposes a shared maintenance workshop for staff. Consider the cost beside the town’s service goal.",
    "choices": [
     {
      "label": "Fund shared training",
      "explanation": "EPA emphasises responsible staff and dedicated maintenance funding. The permanent service points are a game simplification, not a measure of learning or staff competence.",
      "sourceRefs": [
       "town-water-maintenance"
      ]
     },
     {
      "label": "Keep funds for next year",
      "explanation": "Keeping a reserve protects the budget, but does not add service points in this scenario. Ongoing work still needs a funding plan.",
      "sourceRefs": [
       "town-water-maintenance"
      ]
     }
    ]
   }
  ],
  "sources": [
   {
    "id": "town-business-breakeven",
    "title": "SBA — Plan your business",
    "locator": "Paraphrased research notes · Break-even point; Tips and tricks",
    "excerpt": "A business breaks even when its total revenue equals its total costs. For one product, the unit break-even estimate divides fixed costs by selling price minus variable cost per unit. SBA presents this as a planning estimate, not an exact prediction of future accounting results."
   },
   {
    "id": "town-business-costs",
    "title": "SBA — Break-even point calculator",
    "locator": "Paraphrased research notes · Calculate your total fixed costs; Calculate your total variable costs per unit",
    "excerpt": "Fixed costs are tied to a time period and do not change with sales volume within the stated model. Variable costs change with the number of units produced. The calculator asks separately for expected sales, selling price, fixed costs and variable cost per unit. Some real costs combine fixed and variable components."
   },
   {
    "id": "town-water-benefits",
    "title": "US EPA — Environmental Benefits of Green Infrastructure",
    "locator": "Paraphrased research notes · Improves Water Quality; Reduces Localized Flooding; Captures Water for Reuse",
    "excerpt": "Runoff from sealed surfaces can transport pollutants. Green infrastructure can capture water and filter pollutants, and slow or temporarily store runoff from small, frequent storms. Suitable systems can collect rainwater for irrigation. Infiltration depends on site conditions. These functions reduce some pressures on drainage; they are not a promise of zero flooding."
   },
   {
    "id": "town-water-maintenance",
    "title": "US EPA — Green Infrastructure Installation, Operation, and Maintenance",
    "locator": "Paraphrased research notes · Operation and Maintenance; Secure Funding for Maintenance",
    "excerpt": "Green infrastructure needs appropriate installation, inspection and continuing maintenance to function as intended. Work may include clearing sediment and debris, caring for plants and repairing damage. Public assets typically need a municipal maintenance plan, responsible staff and dedicated funding for ongoing work. Tasks and equipment depend on the particular installation."
   }
  ],
  "id": "living-town-river-commons",
  "topicId": "river-commons",
  "title": "River Commons",
  "subtitle": "Sustainability · services and upkeep",
  "focus": "stewardship",
  "hook": "A new council wants to care for the river while keeping the town running. Connect homes, fund services and maintain green spaces. Use the ledger to decide what the town can sustain.",
  "ending": "A town is a connected system. Your record shows what changed after each decision. Explain a trade-off using the ledger and the source notes, then rebuild and compare another approach. Completing the game is not a measure of mastery.",
  "debrief": {
   "question": "How did you balance a better nature index with the continuing cost of services?",
   "explanation": "Distinguish a one-time construction payment from ongoing upkeep. Then explain the conceptual lesson using the sources. Income, demand, staffing, service radius and the nature index are authored game rules; they are not real forecasts.",
   "sourceRefs": [
    "town-business-breakeven",
    "town-business-costs",
    "town-water-benefits",
    "town-water-maintenance"
   ]
  }
 }
];
export const TOWN_PACKS=raw.map(validateTownContent);
export const TOWN_SOURCE_URLS={"town-business-breakeven": "https://www.sba.gov/counseling/plan-your-business/", "town-business-costs": "https://legacy.sba.gov/business-guide/plan-your-business/calculate-your-startup-costs/break-even-point/calculate", "town-water-benefits": "https://www.epa.gov/green-infrastructure/environmental-benefits-green-infrastructure", "town-water-maintenance": "https://www.epa.gov/green-infrastructure/green-infrastructure-installation-operation-and-maintenance"};
