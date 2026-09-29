import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { project } from './project';
import './styles.css';

function App() {
  const [status, setStatus] = useState('Not checked');
  const [checking, setChecking] = useState(false);

  async function checkService() {
    setChecking(true);
    setStatus('Connecting…');
    try {
      const response = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error('Service unavailable');
      const data: unknown = await response.json();
      if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'scaffold') {
        throw new Error('Unexpected response');
      }
      setStatus('Starter service is running');
    } catch {
      setStatus('Service unavailable. Follow the repository setup instructions.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <main>
      <nav aria-label="Project links"><span className="wordmark">multiplayer-racer</span><a href={project.url}>GitHub ↗</a></nav>
      <section className="hero" aria-labelledby="title">
        <p className="eyebrow">OPEN SOURCE / PROJECT SCAFFOLD</p>
        <h1 id="title">{project.title}</h1>
        <p className="tagline">{project.tagline}</p>
        <p className="notice">The foundation is ready. The product features below are planned and are not yet implemented.</p>
        <a className="primary" href={project.url + '/blob/main/docs/ROADMAP.md'}>Explore the roadmap <span aria-hidden="true">→</span></a>
      </section>
      <section className="plan" aria-labelledby="plan-title">
        <div><p className="eyebrow">WHAT COMES NEXT</p><h2 id="plan-title">One useful step at a time.</h2></div>
        <ol>{project.milestones.map((milestone, index) => <li key={milestone}><span className="number">0{index + 1}</span><span>{milestone}</span><span className="badge">Planned</span></li>)}</ol>
      </section>
      <footer>
        <p>{project.stack}</p>
        {project.hasServer && <div className="service"><button disabled={checking} onClick={() => void checkService()}>{checking ? 'Checking…' : 'Check starter service'}</button><span role="status">{status}</span></div>}
        <span>MIT licensed · v0.0.1</span>
      </footer>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');
createRoot(root).render(<StrictMode><App /></StrictMode>);
