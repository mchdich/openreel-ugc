// Original fictional fixtures. These are NOT real TikTok accounts or performance data.
const formats = [
  ['Campus confession', 'study apps', 'I thought everyone else had college figured out.', 'A relatable confession leads into a study workflow. Show a messy desk, reveal a three-step study plan, then show the finished notes.', 'NYU', 'New York'],
  ['You are using it wrong', 'AI tools', 'You are using your AI assistant like a search engine.', 'Open on the mistaken workflow. Compare a vague prompt with a specific prompt and show the result side by side. End with a simple next step.', '', 'San Francisco'],
  ['Seven day test', 'skincare', 'I stopped changing my routine and tried this for seven days.', 'Day one sets a specific expectation. Quick daily check-ins show the same angle and lighting. Finish with the actual outcome and what did not change.', '', 'Los Angeles'],
  ['Two phone reveal', 'couples apps', 'We swapped our lock screens. This was his reaction.', 'Two phones sit side by side on a dark desk. A warm lamp lights the scene. Reveal the paired lock screens and capture the real reaction.', '', 'New York'],
  ['Before the reveal', 'fitness', 'I was doing the hard part and skipping the part that mattered.', 'Start with the frustrating everyday problem. Demonstrate the one small adjustment. Show the before and after workflow without promising health results.', '', 'Austin'],
  ['Campus confession', 'study apps', 'Nobody tells you how lonely the first week can feel.', 'A quiet first-person story about finding a study group at university. Introduce the helpful tool after the emotional setup. Show the group planning its week.', 'NYU', 'New York'],
  ['One minute workflow', 'productivity', 'This is the one minute I wish I had back every day.', 'Show a repetitive task in real time, then the simplified workflow. Put the time saved on screen and let the viewer compare both versions.', 'UCLA', 'Los Angeles']
];
export const demoRecords = formats.flatMap((f,group) => Array.from({length:4},(_,i)=>({
  id:`example-${group}-${i}`, handle:`example.${['maya','sam','alex','jules'][i]}${group+1}`,
  caption:`${f[2]} ${['A day in my life.','The small change that helped.','Watch the last step.','Here is what happened.'][i]}`,
  transcript:f[3],hook:f[2],format:f[0],niche:f[1],school:f[4],location:f[5],
  followers:[1850,3400,7200,1680][i]+group*61,
  views:[184200,96700,211300,78400][i]+group*8130,
  likes:[15800,7400,19100,5600][i]+group*430,
  comments:[284,157,420,108][i]+group*12,shares:[1900,840,2400,640][i]+group*71,
  postedAt:`2026-10-${String(17-i).padStart(2,'0')}T12:00:00.000Z`,
  email:i===0?`example${group+1}@example.com`:'',url:'',thumbnail:'',demo:true
})));
