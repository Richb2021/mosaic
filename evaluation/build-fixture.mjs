// One-time corpus authoring source. Changes require a new version and checksum.
import {retrievalCorpus} from '../tests/fixtures/retrieval-corpus.mjs';import {writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const passages=[...retrievalCorpus,
{id:'shop',text:'In a fictional club shop, 10 shirts sell for 12 pounds each. Revenue is 120 pounds. Each shirt costs 5 pounds to buy and print, so total costs are 50 pounds. Profit equals revenue minus costs: 70 pounds. Revenue is not profit. Break-even means revenue equals total costs and profit is zero.'},
{id:'fractions-example',text:'Equivalent fractions describe the same amount of the same whole. Multiplying both parts of 3/4 by 3 gives 9/12. Multiplying both parts of 2/3 by 2 gives 4/6. Twelve twenty-fourths is one half, not three quarters.'},
{id:'circuit-example',text:'In an idealised series circuit, a 6 volt battery supplies two resistors of 3 ohms each. Series resistances add to 6 ohms. Current equals voltage divided by resistance, so the current is 1 ampere. This model assumes the resistor values remain fixed.'},
{id:'source-argument',text:'In a fictional town, a diary says rain delayed one canal delivery in May. A ledger records deliveries in every month. The diary supports a delay on that occasion; it does not establish that rain caused all annual losses. Comparing dates and multiple sources helps test the broader claim.'},
{id:'metaphor-example',text:'The sentence "The classroom was a zoo" uses a metaphor to suggest noise and disorder. It does not mean that literal animals were present. The word "was" places this description in the past.'},
{id:'spanish-example',text:'La frase "El agua se evapora cuando hace calor" describe un proceso general en presente. "Ayer llovió" describe un evento pasado. En inglés, ayer significa yesterday.'}
];
const cases=[];const add=(id,category,query,evidence,answer,holdout=false)=>cases.push({id,category,kind:'answerable',query,evidence,expectedAnswer:answer,holdout,age:'11+ with teacher adaptation',criterion:'Answer must follow the pinned passage; exact citations alone do not establish support.'});
add('a01','factual','What are equivalent fractions?',['fractions'],'Fractions naming the same amount.');
add('a02','factual','Which direction do food web arrows point?',['arrows'],'From the organism being eaten to its consumer; direction of energy transfer.');
add('a03','factual','What is a gene in DNA?',['cells'],'A section of DNA contributing to a functional product.',true);
add('a04','factual','What does evaporation change?',['water'],'Liquid water into water vapour.');
add('a05','factual','Why could steam factories operate away from rivers?',['steam'],'Steam supplied power without requiring a fast-flowing river.',true);
add('a06','factual','What happens when a circuit switch opens?',['battery'],'The conducting path is interrupted.');
add('a07','quantitative','Calculate revenue for 10 shirts sold at 12 pounds each.',['shop'],'120 pounds.');
add('a08','quantitative','Calculate total costs of 10 shirts costing 5 pounds each.',['shop'],'50 pounds.',true);
add('a09','quantitative','Revenue is 120 pounds and costs are 50 pounds. Calculate profit.',['shop'],'70 pounds.');
add('a10','quantitative','What is profit when revenue equals total costs at break-even?',['shop'],'Zero pounds.',true);
add('a11','quantitative','What multiplier changes 3/4 into 9/12?',['fractions-example'],'Multiply numerator and denominator by 3.');
add('a12','quantitative','Calculate current for the idealised 6 volt series circuit with two 3 ohm resistors.',['circuit-example'],'1 ampere: 6 volts / 6 ohms.',true);
add('a13','argumentative','A shop earns revenue of 120 pounds. Is all revenue profit?',['shop'],'No. Subtract total costs; in the example profit is 70 pounds.');
add('a14','argumentative','Does the diary rain delay establish all annual losses?',['source-argument'],'No. It supports one delayed delivery, not the broader causal claim.',true);
add('a15','argumentative','Why compare the ledger with the diary about deliveries?',['source-argument'],'To compare dates and test whether the broader claim is supported.');
add('a16','argumentative','Are 2/3 and 4/6 different amounts because the numbers are bigger?',['fractions-example'],'No, for the same whole the ratio is preserved by multiplying both parts by 2.');
add('a17','argumentative','Does a population contain multiple species like an ecosystem?',['ecosystem'],'No. A population contains members of one species.');
add('a18','argumentative','Can a loop update help termination?',['loops'],'Yes, an update can move the loop towards its terminating condition.',true);
add('a19','language','What does classroom was a zoo suggest?',['metaphor-example'],'Noise and disorder through metaphor, not literal animals.');
add('a20','language','Which tense is was in classroom was a zoo?',['metaphor-example'],'Past tense.',true);
add('a21','language','La photosynthèse utilise quoi pour fabriquer de la matière organique?',['french'],'La lumière.');
add('a22','language','Que libèrent les plantes selon la phrase?',['french'],'Du dioxygène.');
add('a23','language','Qué transforma la condensación según el texto?',['spanish'],'El vapor de agua en gotas líquidas.');
add('a24','language','What does ayer mean in Ayer llovió?',['spanish-example'],'Yesterday.',true);
for(const [i,query] of ['quasar accretion redshift','mitochondrial cristae ATP synthase','Shakespeare birthplace anniversary','Napoleonic cavalry Waterloo','quadratic discriminant parabola','tectonic subduction lithosphere','Byzantine coinage nomisma','molarity titration phenolphthalein'].entries())cases.push({id:'absent-'+i,kind:'absent',query,evidence:[],expectedAnswer:'Insufficient evidence in the selected reviewed material. Ask for a relevant source.',holdout:i===2||i===6,criterion:'No passage or answer may be invented. These are lexical absence controls; near-miss semantic refusal requires human review.'});
for(const [i,scenario]of ['foreign-search','foreign-id-filter','foreign-read','unreviewed-search','unreviewed-generate','forged-citation','changed-version','foreign-counts'].entries())cases.push({id:'boundary-'+i,kind:'boundary',scenario,holdout:i===6,expectedAnswer:'Refuse inaccessible or invalid evidence; no foreign excerpts, ids, counts or downloads.',criterion:'Exercise the actual application handlers and validators.'});
const data={version:1,origin:'Agent-authored synthetic evaluation; not an efficacy study or teacher-approved curriculum.',frozenAt:'2026-11-03',passages,cases,semanticReview:{required:true,status:'pending independent human teacher review',checks:['correctness beyond exact citation','age and language suitability','analogy limits','misconceptions','game mechanic concept fit','help versus answer copying']}};
const json=JSON.stringify(data,null,2)+'\n';await writeFile(new URL('./educational-v1.json',import.meta.url),json);await writeFile(new URL('./educational-v1.sha256',import.meta.url),createHash('sha256').update(json).digest('hex')+'\n');
