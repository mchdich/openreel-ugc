/** Keep OpenAI reasoning models compatible without changing local/legacy providers. */
export function completionOptions(model,maxTokens,reasoning='low'){
  if(/^gpt-[56](?:[.-]|$)|^o[134](?:-|$)/i.test(model))return {max_completion_tokens:Math.max(5000,maxTokens),reasoning_effort:reasoning};
  return {temperature:0.2,max_tokens:maxTokens};
}
