const CORRECT_TONE_PLAN = Object.freeze([
  Object.freeze({ frequency: 659.25, start: 0, duration: 0.16, type: 'sine', volume: 0.09 }),
  Object.freeze({ frequency: 783.99, start: 0.17, duration: 0.28, type: 'sine', volume: 0.1 }),
]);

const INCORRECT_TONE_PLAN = Object.freeze([
  Object.freeze({ frequency: 174.61, start: 0, duration: 0.18, type: 'square', volume: 0.045 }),
  Object.freeze({ frequency: 146.83, start: 0.2, duration: 0.28, type: 'square', volume: 0.04 }),
]);

export function getQuizFeedbackTonePlan(isCorrect) {
  return isCorrect ? CORRECT_TONE_PLAN : INCORRECT_TONE_PLAN;
}

export function createQuizFeedbackSoundPlayer({
  AudioContextRef = globalThis.AudioContext || globalThis.webkitAudioContext,
} = {}) {
  let context = null;

  async function prime() {
    if (!AudioContextRef) return false;
    try {
      context ||= new AudioContextRef();
      if (context.state === 'suspended' && typeof context.resume === 'function') {
        await context.resume();
      }
      return context.state !== 'closed';
    } catch {
      return false;
    }
  }

  async function play(isCorrect) {
    if (!await prime() || !context) return false;
    const baseTime = context.currentTime + 0.01;

    try {
      getQuizFeedbackTonePlan(isCorrect).forEach((tone) => {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        const startTime = baseTime + tone.start;
        const endTime = startTime + tone.duration;

        oscillator.type = tone.type;
        oscillator.frequency.setValueAtTime(tone.frequency, startTime);
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(tone.volume, startTime + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start(startTime);
        oscillator.stop(endTime + 0.01);
      });
      return true;
    } catch {
      return false;
    }
  }

  return Object.freeze({ prime, play });
}
