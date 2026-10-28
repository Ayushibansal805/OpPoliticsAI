import { ArrowLeft, Gauge, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Card, Notice, PageIntro } from '../components/ui';

export function ComingSoonPage() {
  const location = useLocation(); const risk = location.pathname.includes('operational-risk'); const title = risk ? 'Operational Risk Intelligence' : 'Workload Forecasting'; const icon = risk ? <Sparkles size={22} /> : <Gauge size={22} />;
  return <div className="page-stack"><PageIntro eyebrow="Reserved model surface" title={title} description="This module is reserved for the next verified model integration." /><Notice variant="warning"><strong>Coming soon.</strong> This route is intentionally unavailable until the model artifact, input contract, health check, and evaluation evidence are connected.</Notice><Card className="coming-soon-card"><span className="coming-icon">{icon}</span><h2>A clean space for the next signal.</h2><p>Authentication, navigation, model registry, prediction history, and service health are already shared. Your teammate can register this model without rewriting the workspace infrastructure.</p><div className="coming-actions"><Link className="button button-primary" to="/app/models">Open model center</Link><Link className="button button-ghost" to="/app"><ArrowLeft size={15} /> Back to overview</Link></div></Card></div>;
}
