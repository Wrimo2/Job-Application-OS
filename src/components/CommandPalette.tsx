import * as React from 'react';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  CalendarPlus,
  CornerDownLeft,
  Download,
  Keyboard,
  ListTodo,
  MessageSquarePlus,
  Moon,
  NotebookPen,
  Search,
  Sparkles,
  UserPlus,
  Settings,
  FileText,
} from 'lucide-react';
import { useUI } from '@/lib/store';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/hooks';
import { updateSettings } from '@/lib/db';
import { exportBackup } from '@/lib/io';
import { STAGE_MAP } from '@/lib/constants';
import { modKey } from '@/lib/utils';
import { NAV } from './layout';
import { Avatar, CompanyLogo } from './common';
import { Kbd } from './ui';
import { Modal } from './overlay';
import { toast } from 'sonner';

const itemCls =
  'flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] outline-none data-[selected=true]:bg-accent [&_svg]:text-muted-foreground';

const groupCls =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground';

export function CommandPalette() {
  const ui = useUI();
  const open = useUI((s) => s.palette);
  const navigate = useNavigate();
  const settings = useSettings();
  const { apps, contacts, companies, templates } = useData();
  const [search, setSearch] = useState('');

  const run = (fn: () => void) => {
    ui.setPalette(false);
    setSearch('');
    setTimeout(fn, 10);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { ui.setPalette(v); if (!v) setSearch(''); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-[10vh] z-50 w-[calc(100vw-1.5rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border bg-popover shadow-2xl outline-none data-[state=open]:animate-scale-in">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search applications, people, companies and actions</Dialog.Description>
          <Command loop className="flex max-h-[70vh] flex-col">
            <div className="flex items-center gap-3 border-b px-4">
              <Search className="h-[18px] w-[18px] text-muted-foreground" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                autoFocus
                placeholder="Search applications, people, companies, templates…"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="min-h-0 flex-1 overflow-y-auto p-2">
              <Command.Empty className="px-4 py-10 text-center text-sm text-muted-foreground">No results for “{search}”.</Command.Empty>

              <Command.Group heading="Quick actions" className={groupCls}>
                <Command.Item value="new application add job" onSelect={() => run(() => ui.openAppForm())} className={itemCls}>
                  <Briefcase className="h-4 w-4" /> New application <Kbd className="ml-auto">N</Kbd>
                </Command.Item>
                <Command.Item value="new contact person target recruiter" onSelect={() => run(() => ui.openContactForm())} className={itemCls}>
                  <UserPlus className="h-4 w-4" /> New contact / target <Kbd className="ml-auto">C</Kbd>
                </Command.Item>
                <Command.Item value="compose message outreach write" onSelect={() => run(() => ui.openComposer())} className={itemCls}>
                  <MessageSquarePlus className="h-4 w-4" /> Compose outreach message <Kbd className="ml-auto">M</Kbd>
                </Command.Item>
                <Command.Item value="log outreach interaction touch" onSelect={() => run(() => ui.openLog())} className={itemCls}>
                  <NotebookPen className="h-4 w-4" /> Log an outreach touch <Kbd className="ml-auto">L</Kbd>
                </Command.Item>
                <Command.Item value="schedule interview" onSelect={() => run(() => ui.openInterviewForm())} className={itemCls}>
                  <CalendarPlus className="h-4 w-4" /> Schedule an interview <Kbd className="ml-auto">I</Kbd>
                </Command.Item>
                <Command.Item value="new task reminder todo" onSelect={() => run(() => ui.openTaskForm())} className={itemCls}>
                  <ListTodo className="h-4 w-4" /> New task / reminder <Kbd className="ml-auto">T</Kbd>
                </Command.Item>
                <Command.Item
                  value="toggle theme dark light mode"
                  onSelect={() => run(() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }))}
                  className={itemCls}
                >
                  <Moon className="h-4 w-4" /> Toggle dark mode
                </Command.Item>
                <Command.Item value="export backup download json" onSelect={() => run(() => exportBackup().then(() => toast.success('Backup downloaded')))} className={itemCls}>
                  <Download className="h-4 w-4" /> Export backup (JSON)
                </Command.Item>
                <Command.Item value="keyboard shortcuts help" onSelect={() => run(() => ui.setShortcuts(true))} className={itemCls}>
                  <Keyboard className="h-4 w-4" /> Keyboard shortcuts <Kbd className="ml-auto">?</Kbd>
                </Command.Item>
              </Command.Group>

              <Command.Group heading="Go to" className={groupCls}>
                {NAV.flatMap((s) => s.items).map((it) => (
                  <Command.Item key={it.to} value={`go ${it.label}`} onSelect={() => run(() => navigate(it.to))} className={itemCls}>
                    <it.icon className="h-4 w-4" /> {it.label}
                    {it.keys && <span className="ml-auto text-[11px] text-muted-foreground">{it.keys}</span>}
                  </Command.Item>
                ))}
                <Command.Item value="go settings profile" onSelect={() => run(() => navigate('/settings'))} className={itemCls}>
                  <Settings className="h-4 w-4" /> Settings & profile
                </Command.Item>
              </Command.Group>

              {search.length > 0 && (
                <>
                  <Command.Group heading="Applications" className={groupCls}>
                    {apps.slice(0, 400).map((a) => (
                      <Command.Item
                        key={a.id}
                        value={`app ${a.role} ${a.company} ${a.id}`}
                        onSelect={() => run(() => ui.openDrawer('application', a.id))}
                        className={itemCls}
                      >
                        <CompanyLogo name={a.company} size={22} rounded="rounded-md" />
                        <span className="min-w-0 flex-1 truncate">
                          {a.role} <span className="text-muted-foreground">· {a.company}</span>
                        </span>
                        <span className="text-[11px] text-muted-foreground">{STAGE_MAP[a.status].label}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                  <Command.Group heading="People" className={groupCls}>
                    {contacts.slice(0, 600).map((c) => (
                      <Command.Item
                        key={c.id}
                        value={`person ${c.name} ${c.company ?? ''} ${c.title ?? ''} ${c.id}`}
                        onSelect={() => run(() => ui.openDrawer('contact', c.id))}
                        className={itemCls}
                      >
                        <Avatar name={c.name} size={22} />
                        <span className="min-w-0 flex-1 truncate">
                          {c.name} <span className="text-muted-foreground">· {c.title}{c.company ? ` @ ${c.company}` : ''}</span>
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                  <Command.Group heading="Companies" className={groupCls}>
                    {companies.slice(0, 300).map((c) => (
                      <Command.Item key={c.id} value={`company ${c.name} ${c.industry ?? ''} ${c.id}`} onSelect={() => run(() => ui.openDrawer('company', c.id))} className={itemCls}>
                        <Building2 className="h-4 w-4" />
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="text-[11px] text-muted-foreground">{c.industry}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                  <Command.Group heading="Templates" className={groupCls}>
                    {templates.map((t) => (
                      <Command.Item key={t.id} value={`template ${t.name} ${t.category} ${t.id}`} onSelect={() => run(() => ui.openComposer({ templateId: t.id }))} className={itemCls}>
                        <FileText className="h-4 w-4" />
                        <span className="flex-1 truncate">{t.name}</span>
                        <span className="text-[11px] text-muted-foreground">Compose</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                </>
              )}
            </Command.List>
            <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Tip: type a company or person to jump straight to it
              </span>
              <span className="hidden items-center gap-1 sm:inline-flex">
                <CornerDownLeft className="h-3.5 w-3.5" /> to select
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const SHORTCUTS: [string, string[]][] = [
  ['Search / command palette', [modKey, 'K']],
  ['New application', ['N']],
  ['New contact', ['C']],
  ['Compose message', ['M']],
  ['Log outreach', ['L']],
  ['Schedule interview', ['I']],
  ['New task', ['T']],
  ['Go to Dashboard', ['G', 'D']],
  ['Go to Agenda', ['G', 'T']],
  ['Go to Applications', ['G', 'A']],
  ['Go to Outreach', ['G', 'O']],
  ['Go to Contacts', ['G', 'C']],
  ['Go to Companies', ['G', 'M']],
  ['Go to Interviews', ['G', 'I']],
  ['Go to Analytics', ['G', 'N']],
  ['Go to Offers', ['G', 'F']],
  ['Go to Documents', ['G', 'R']],
  ['Go to Settings', ['G', 'S']],
  ['Show shortcuts', ['?']],
];

export function ShortcutsDialog() {
  const open = useUI((s) => s.shortcuts);
  const set = useUI((s) => s.setShortcuts);
  return (
    <Modal open={open} onOpenChange={set} title="Keyboard shortcuts" description="Move fast — everything is a keystroke away." icon={<Keyboard className="h-4 w-4" />}>
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {SHORTCUTS.map(([label, keys]) => (
          <div key={label} className="flex items-center justify-between border-b border-dashed py-2 text-[13px]">
            <span className="text-foreground/90">{label}</span>
            <span className="flex items-center gap-1">
              {keys.map((k, i) => (
                <React.Fragment key={i}>
                  {i > 0 && keys[0] === 'G' && <span className="text-[10px] text-muted-foreground">then</span>}
                  <Kbd>{k}</Kbd>
                </React.Fragment>
              ))}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
