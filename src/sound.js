// Original procedural effects. Music remains the four licensed Suno cues.
export class Sound{
 constructor(){this.enabled=false;this.volume=.25;this.lastStep=0}
 async enable(value){this.enabled=value;if(value){this.ctx??=new AudioContext();await this.ctx.resume()}}
 play(kind){if(!this.enabled||!this.ctx||document.hidden)return;const ctx=this.ctx,t=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();const spec={step:[110,65,.045],ui:[480,640,.05],strike:[170,45,.14],magic:[330,880,.35],mechanism:[220,440,.45],reward:[440,880,.55]}[kind]||[180,120,.1];osc.type=kind==='step'||kind==='strike'?'triangle':'sine';osc.frequency.setValueAtTime(spec[0],t);osc.frequency.exponentialRampToValueAtTime(spec[1],t+spec[2]);gain.gain.setValueAtTime(this.volume*(kind==='step'?.2:.5),t);gain.gain.exponentialRampToValueAtTime(.001,t+spec[2]);osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+spec[2]);osc.onended=()=>{osc.disconnect();gain.disconnect()}}
 step(){if(performance.now()-this.lastStep>320){this.play('step');this.lastStep=performance.now()}}
}
