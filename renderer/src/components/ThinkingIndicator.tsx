import { useState, useEffect, useRef } from 'react';

const PHRASES = [
  'Thinking', 'Reasoning', 'Processing', 'Analyzing', 'Reflecting', 'Pondering',
  'Contemplating', 'Deliberating', 'Evaluating', 'Interpreting', 'Understanding',
  'Figuring it out', 'Working it out', 'Breaking it down', 'Connecting ideas',
  'Synthesizing', 'Formulating', 'Organizing thoughts', 'Reviewing', 'Rechecking',
  'Brainstorming', 'Tinkering', 'Exploring', 'Digging in', 'Untangling', 'Decoding',
  'Mapping it out', 'Piecing it together', 'Cooking up an answer', 'Sharpening logic',
  'Structuring output', 'Building context', 'Scanning possibilities', 'Weighing options',
  'Filtering noise', 'Optimizing reasoning', 'Searching patterns', 'Testing ideas',
  'Simulating outcomes', 'Let me think', "Let's see", 'Hmm', 'One moment',
  'Almost there', 'Thinking through this', 'Working on it', 'Getting clarity',
  'Putting it together', 'Double-checking', 'Stepping through it', 'Re-evaluating',
  'Getting the details right', 'Holding that thought', 'Forming response',
  'Constructing answer', 'Drafting logic', 'Aligning ideas', 'Sorting information',
  'Processing inputs', 'Parsing meaning', 'Extracting insight', 'Reviewing data',
  'Inspecting details', 'Examining closely', 'Looking deeper', 'Going deeper',
  'Thinking deeper', 'Expanding thought', 'Narrowing focus', 'Clarifying intent',
  'Inferring meaning', 'Drawing conclusions', 'Reassessing', 'Reconstructing logic',
  'Rebuilding understanding', 'Checking assumptions', 'Validating idea',
  'Confirming reasoning', 'Running analysis', 'Mental modeling', 'Cognitive processing',
  'Pattern matching', 'Signal extraction', 'Noise reduction', 'Idea exploration',
  'Thought formation', 'Logic building', 'Insight generation', 'Knowledge synthesis',
  'Information structuring', 'Context building', 'Thought sequencing',
  'Reasoning step-by-step', 'Breaking complexity', 'Simplifying structure',
  'Organizing reasoning chain', 'Evaluating possibilities', 'Exploring angles',
  'Considering options', 'Weighing evidence', 'Checking consistency', 'Testing logic',
  'Verifying steps', 'Debugging thought process', 'Running mental simulation',
  'Iterating reasoning', 'Refining answer', 'Improving clarity', 'Enhancing logic',
  'Tightening explanation', 'Strengthening argument', 'Reworking idea',
  'Adjusting reasoning', 'Fine-tuning output', 'Polishing thought',
  'Finalizing reasoning', 'Almost ready', 'Nearly done', 'Getting there',
  'Still thinking', 'Just a second', 'Give me a moment', 'Working through details',
  'Sorting complexity', 'Handling nuance', 'Parsing context', 'Reading between lines',
  'Understanding structure', 'Building response', 'Preparing answer', 'Assembling logic',
  'Collecting thoughts', 'Gathering insight', 'Pulling information together',
  'Organizing response', 'Structuring reply', 'Composing answer', 'Writing mentally',
  'Forming explanation', 'Drafting response', 'Thinking aloud', 'Internal reasoning',
  'Silent analysis', 'Deep processing', 'Fast reasoning', 'Slow careful thinking',
  'Careful analysis', 'Quick evaluation', 'Rapid processing', 'Thorough examination',
  'Deep dive', 'Mental pass', 'Multi-step reasoning', 'Layered thinking',
  'Hierarchical analysis', 'Sequential reasoning', 'Parallel thinking', 'Concept mapping',
  'Idea linking', 'Knowledge traversal', 'Cognitive scan', 'Analytical sweep',
  'Thought scan', 'Reasoning pass', 'Logic pass', 'Evaluation pass', 'Final pass',
  'Initial thinking', 'Pre-finalizing', 'Post-processing', 'Bootstrapping reasoning',
  'Converging on solution', 'Exploring branches', 'Pruning options', 'Selecting path',
  'Decision forming', 'Insight crystallizing', 'Idea refinement', 'Signal interpretation',
  'Context interpretation', 'Meaning extraction', 'Intent detection', 'Goal alignment',
  'Response shaping', 'Output crafting', 'Answer shaping', 'Logic shaping',
  'Reasoning shaping', 'Structuring insight', 'Organizing cognition', 'Mental structuring',
  'Thought architecture', 'Reasoning architecture', 'Building framework',
  'Constructing framework', 'Framework analysis', 'System thinking', 'Holistic reasoning',
  'Linear reasoning', 'Abstract thinking', 'Concrete reasoning', 'Meta thinking',
  'Self-checking logic', 'Recursive thinking', 'Iterative thinking', 'Active reasoning',
  'Focused thinking', 'Diffuse thinking', 'Expanding analysis', 'Compressing thought',
  'Condensing reasoning', 'Elaborating idea', 'Summarizing mentally',
  'Extracting core idea', 'Identifying key points', 'Highlighting relevance',
  'Filtering importance', 'Ranking ideas', 'Prioritizing logic', 'Ordering thoughts',
  'Sequencing ideas', 'Aligning reasoning', 'Stabilizing logic', 'Balancing arguments',
  'Cross-checking', 'Multi-angle analysis', 'Perspective shifting', 'Context switching',
  'Adaptive reasoning', 'Dynamic thinking', 'Fluid analysis', 'Structured reasoning',
  'Open-ended thinking', 'Goal-oriented reasoning', 'Solution search', 'Insight search',
  'Pattern search', 'Connection search', 'Deep inspection', 'Broad scan',
  'Narrow focus', 'Zooming in', 'Zooming out', 'Detail checking', 'Macro analysis',
  'Micro analysis', 'Thought compression', 'Idea expansion', 'Clarification pass',
  'Final review', 'Pre-output check', 'Output validation', 'Response preparation',
  'Answer finalization', 'Done thinking',
];

export default function ThinkingIndicator() {
  const [phraseIdx, setPhraseIdx] = useState(() => Math.floor(Math.random() * PHRASES.length));
  const [dotCount, setDotCount] = useState(1);
  const [visible, setVisible] = useState(true);

  // Rotate phrase every ~2.2 seconds with a fade
  useEffect(() => {
    const phraseTimer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPhraseIdx((i) => (i + 1) % PHRASES.length);
        setVisible(true);
      }, 200);
    }, 2200);
    return () => clearInterval(phraseTimer);
  }, []);

  // Animate dots: 1 → 2 → 3 → 1
  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDotCount((d) => (d % 3) + 1);
    }, 500);
    return () => clearInterval(dotTimer);
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 0',
    }}>
      {/* Animated dots */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            style={{
              width: 5, height: 5, borderRadius: '50%',
              background: n <= dotCount ? '#bbb' : '#e5e5e5',
              transition: 'background 0.3s',
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Rotating phrase */}
      <span style={{
        fontSize: 14, color: '#aaa',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
        fontStyle: 'italic',
      }}>
        {PHRASES[phraseIdx]}…
      </span>
    </div>
  );
}
