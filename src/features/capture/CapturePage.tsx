import * as React from 'react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bookmark, BookmarkPlus, CircleCheck, ExternalLink, Pencil, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/lib/store';
import { useData } from '@/lib/data';
import { createApplication } from '@/lib/actions';
import { companyFromUrl, detectPlatform, parseJobTitle, suggestMethod } from '@/lib/toolkit';
import { platformMeta } from '@/lib/constants';
import type { Application } from '@/lib/types';
import { companyKey, hostOf } from '@/lib/utils';
import { Button, Card, Field, Input } from '@/components/ui';
import { CompanyLogo } from '@/components/common';

export default function CapturePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ui = useUI();
  const { apps, contacts } = useData();
  const url = params.get('url') ?? '';
  const title = params.get('title') ?? '';
  const jd = params.get('jd') ?? '';
  const parsed = useMemo(() => parseJobTitle(title, url), [title, url]);
  const platform = detectPlatform(url) ?? 'other';
  const [role, setRole] = useState(parsed.role ?? '');
  const [company, setCompany] = useState(parsed.company ?? companyFromUrl(url) ?? '');
  const [location, setLocation] = useState(parsed.location ?? '');
  const [saved, setSaved] = useState<Application | null>(null);
  const existing = apps.find((a) => a.url && url && a.url === url);
  const known = contacts.filter((c) => company && companyKey(c.company) === companyKey(company));

  const save = async (status: 'wishlist' | 'applied') => {
    if (!role.trim() || !company.trim()) return toast.error('Add the role and company');
    const app = await createApplication({
      role,
      company,
      location: location || undefined,
      url: url || undefined,
      platform,
      method: suggestMethod(platform),
      status,
      jobDescription: jd || undefined,
      tags: ['captured'],
    });
    setSaved(app);
    toast.success(status === 'wishlist' ? 'Saved to your wishlist' : 'Logged as applied — follow-up scheduled');
  };

  if (!url && !title) {
    return (
      <div className="page max-w-xl">
        <Card className="p-8 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-3 text-lg font-semibold">Quick capture</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Install the “Save to Pursuit” button, then click it on any job posting to land here pre-filled.</p>
          <Button className="mt-4" variant="primary" onClick={() => navigate('/settings/capture')}>
            Set up quick capture
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page max-w-2xl">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b bg-gradient-to-r from-primary/10 to-transparent px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
            <BookmarkPlus className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">Captured from {platformMeta(platform).label}</div>
            <div className="truncate text-[12.5px] text-muted-foreground">{hostOf(url)}</div>
          </div>
        </div>
        {saved ? (
          <div className="space-y-4 p-6 text-center">
            <CircleCheck className="mx-auto h-10 w-10 text-emerald-500" />
            <div>
              <div className="text-lg font-semibold">Saved {saved.role} at {saved.company}</div>
              <p className="text-[13px] text-muted-foreground">{saved.status === 'applied' ? 'A follow-up reminder is scheduled. Now find the recruiter — it multiplies your odds.' : 'It’s on your wishlist. Apply while the posting is fresh.'}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => ui.openDrawer('application', saved.id, 'people')}>
                <Send className="h-4 w-4" /> Find people to contact
              </Button>
              <Button variant="secondary" onClick={() => ui.openDrawer('application', saved.id)}>
                Open application
              </Button>
              <Button variant="ghost" onClick={() => window.close()}>
                Close tab
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {existing && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] text-amber-700 dark:text-amber-300">
                You already saved this link ({existing.status}).{' '}
                <button className="font-medium underline" onClick={() => ui.openDrawer('application', existing.id)}>
                  Open it
                </button>
              </p>
            )}
            <div className="flex items-center gap-3">
              {company && <CompanyLogo name={company} size={44} rounded="rounded-xl" />}
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <Field label="Role">
                  <Input value={role} onChange={(e) => setRole(e.target.value)} autoFocus={!role} />
                </Field>
                <Field label="Company">
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} />
                </Field>
              </div>
            </div>
            <Field label="Location">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
            </Field>
            {jd && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Job description captured ({jd.split(/\s+/).length} words) — keyword match will be ready.
              </p>
            )}
            {known.length > 0 && (
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700 dark:text-emerald-300">
                You know {known.length} {known.length === 1 ? 'person' : 'people'} at {company} ({known.slice(0, 3).map((k) => k.name).join(', ')}). Ask for a referral before applying!
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="secondary" onClick={() => save('wishlist')}>
                <Bookmark className="h-4 w-4" /> Save to wishlist
              </Button>
              <Button variant="primary" onClick={() => save('applied')}>
                <CircleCheck className="h-4 w-4" /> I applied
              </Button>
              <Button
                variant="ghost"
                onClick={() => ui.openAppForm(undefined, { role, company, location: location || undefined, url, platform, method: suggestMethod(platform), status: 'wishlist', jobDescription: jd || undefined })}
              >
                <Pencil className="h-4 w-4" /> More details…
              </Button>
              {url && (
                <a href={url} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
                  Posting <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
