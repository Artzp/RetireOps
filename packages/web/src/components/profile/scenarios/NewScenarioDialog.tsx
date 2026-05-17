'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, TrendingUp, TrendingDown, Settings, Loader2, FileText } from 'lucide-react';
import {
  listScenarioTemplates,
  createProfileScenario,
  createProfileScenarioFromTemplate,
  type ScenarioDecisionTemplateSummary,
} from '@/lib/api/profile-scenarios';
import type { ProfileScenarioListItem } from '@/types/profile-scenario';

interface NewScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (scenario: ProfileScenarioListItem) => void;
}

type Mode =
  | { kind: 'landing' }
  | { kind: 'template'; template: ScenarioDecisionTemplateSummary }
  | { kind: 'blank' };

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  'early-retirement-60': <Clock className="h-6 w-6 text-amber-500" aria-hidden />,
  'delayed-retirement-67': <TrendingUp className="h-6 w-6 text-blue-500" aria-hidden />,
  'reduced-spending-later': <TrendingDown className="h-6 w-6 text-purple-500" aria-hidden />,
};

export function NewScenarioDialog({ open, onOpenChange, onCreated }: NewScenarioDialogProps) {
  const [mode, setMode] = useState<Mode>({ kind: 'landing' });
  const [templates, setTemplates] = useState<ScenarioDecisionTemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode({ kind: 'landing' });
    setScenarioName('');
    setError(null);
    setIsLoading(true);
    listScenarioTemplates()
      .then(setTemplates)
      .catch(() => setError('Failed to load templates.'))
      .finally(() => setIsLoading(false));
  }, [open]);

  const handlePickTemplate = (template: ScenarioDecisionTemplateSummary) => {
    setMode({ kind: 'template', template });
    setScenarioName(template.name);
    setError(null);
  };

  const handlePickBlank = () => {
    setMode({ kind: 'blank' });
    setScenarioName('');
    setError(null);
  };

  const handleBack = () => {
    setMode({ kind: 'landing' });
    setScenarioName('');
    setError(null);
  };

  const handleCreate = async () => {
    if (mode.kind === 'landing') return;
    const trimmedName = scenarioName.trim();
    if (trimmedName === '') return;
    setIsCreating(true);
    setError(null);
    try {
      const created =
        mode.kind === 'template'
          ? await createProfileScenarioFromTemplate(mode.template.id, trimmedName)
          : await createProfileScenario(trimmedName);
      onCreated(created);
      onOpenChange(false);
    } catch {
      setError('Failed to create scenario. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-ds-surface rounded-card">
        <DialogHeader>
          <DialogTitle>New Scenario</DialogTitle>
          <DialogDescription>
            Pick a starting point. You can edit any decision afterwards.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mode.kind === 'landing' ? (
          <div className="space-y-4">
            {error && <p className="text-sm text-ds-error">{error}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-colors bg-ds-surface-raised"
                  onClick={() => handlePickTemplate(template)}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="mt-0.5">
                      {TEMPLATE_ICONS[template.id] ?? (
                        <Settings className="h-6 w-6 text-gray-500" aria-hidden />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-ds-on-surface-variant mt-1">
                        {template.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="pt-2 border-t border-ds-outline-variant">
              <Button variant="ghost" className="w-full justify-start" onClick={handlePickBlank}>
                <FileText className="mr-2 h-4 w-4" />
                Or start from a blank scenario
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {mode.kind === 'template' && (
              <div className="rounded-card bg-ds-surface-raised p-4">
                <p className="text-sm font-semibold">{mode.template.name}</p>
                <p className="text-xs text-ds-on-surface-variant mt-1">
                  {mode.template.description}
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="new-scenario-name">Scenario Name</Label>
              <Input
                id="new-scenario-name"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="e.g. Conservative Plan"
                className="mt-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && scenarioName.trim() !== '' && !isCreating) {
                    void handleCreate();
                  }
                }}
              />
            </div>
            {error && <p className="text-sm text-ds-error">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleBack} disabled={isCreating}>
                Back
              </Button>
              <Button
                className="bg-ds-primary text-ds-on-primary rounded-button"
                onClick={() => void handleCreate()}
                disabled={isCreating || scenarioName.trim() === ''}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Scenario'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
