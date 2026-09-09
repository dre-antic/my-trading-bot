import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  useEffect(() => {
    api<{ jobs: any[] }>("/api/jobs").then((r) => setJobs(r.jobs));
  }, []);
  return (
    <>
      <h1>Jobs</h1>
      <p className="lede">Every production is resumable. Incomplete jobs continue after restart.</p>
      <div className="job-list">
        {jobs.map((j) => (
          <Link key={j.id} to={`/jobs/${j.id}`}>
            <div className="row">
              <strong>{j.request?.topic}</strong>
              <span className="pill">
                {j.status} · {j.stage}
              </span>
            </div>
            <div className="muted">{j.created_at}</div>
          </Link>
        ))}
        {!jobs.length && <p>No jobs yet.</p>}
      </div>
    </>
  );
}
