// Authored synthetic relevance judgements, not an external curriculum or efficacy study.
export const retrievalCorpus=[
 {id:'fractions',text:'Equivalent fractions name the same amount. Multiplying the numerator and denominator by the same nonzero number preserves the ratio.'},
 {id:'steam',text:'Steam engines supplied power to factories. Steam power allowed machinery to work away from fast-flowing rivers during industrialisation.'},
 {id:'towns',text:'Factories attracted workers into towns. Urbanisation changed housing, transport and working conditions during industrialisation.'},
 {id:'arrows',text:'Food web arrows point from the organism being eaten to the consumer. The arrows represent the direction of energy transfer.'},
 {id:'ecosystem',text:'An ecosystem includes organisms, their physical surroundings and the interactions between them. A population contains members of one species.'},
 {id:'water',text:'Evaporation changes liquid water to water vapour. Condensation changes water vapour into liquid droplets when it cools.'},
 {id:'cells',text:'DNA carries genetic information in cells. A gene is a section of DNA that contributes to a functional product.'},
 {id:'inertia',text:'Inertia describes resistance to a change of motion. With no resultant force, an object maintains constant velocity.'},
 {id:'loops',text:'A programming loop repeats instructions. A loop condition controls whether another iteration runs and an update can move it towards termination.'},
 {id:'metaphor',text:'A metaphor describes one thing as another to create a comparison. It can give a reader a new way to imagine an experience.'},
 {id:'french',text:'La photosynthèse utilise la lumière pour fabriquer de la matière organique. Les plantes absorbent du dioxyde de carbone et libèrent du dioxygène.'},
 {id:'spanish',text:'La evaporación transforma el agua líquida en vapor. La condensación transforma el vapor de agua en gotas líquidas.'},
 {id:'battery',text:'A battery can drive an electric current around a complete circuit. Opening a switch interrupts the conducting path.'}
];
export const retrievalCases=[
 {id:'equivalent-fractions',query:'equivalent fractions denominator',relevant:['fractions']},
 {id:'industrial-factories',query:'steam factories industrialisation',relevant:['steam','towns']},
 {id:'food-web',query:'food web energy arrows',relevant:['arrows']},
 {id:'ecosystem-scope',query:'ecosystem organisms surroundings',relevant:['ecosystem']},
 {id:'water-states',query:'evaporation condensation vapour',relevant:['water']},
 {id:'dna',query:'DNA gene cells',relevant:['cells']},
 {id:'loop-termination',query:'loop condition termination',relevant:['loops']},
 {id:'figurative-language',query:'metaphor comparison reader',relevant:['metaphor']},
 {id:'accented-french',query:'photosynthèse lumière plantes',relevant:['french']},
 {id:'accented-spanish',query:'evaporación condensación agua',relevant:['spanish']},
 {id:'reviewed-alternative',query:'keeps moving forever',related:'inertia\nconstant velocity',relevant:['inertia']},
 {id:'circuit-control',query:'battery circuit switch',relevant:['battery']},
 {id:'missing-source',query:'quasars accretion redshift',relevant:[]}
];
