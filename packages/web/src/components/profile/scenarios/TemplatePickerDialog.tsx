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
import { Clock, TrendingUp, TrendingDown, Settings, Loader2 } from 'lucide-react';
import {
  listScenarioTemplates,
  createProfileScenarioFromTemplate,
  type ScenarioDecisionTemplateSummary,
} from '@/lib/api/profile-scenarios';
import type { ProfileScenarioListItem } from '@/types/profile-scenario';

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (scenario: ProfileScenarioListItem) => void;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  'early-retirement-60': <Clock className="h-6 w-6 text-amber-500" aria-hidden />,
  'delayed-retirement-67': <TrendingUp className="h-6 w-6 text-blue-500" aria-hidden />,
  'reduced-spending-later': <TrendingDown className="h-6 w-6 text-purple-500" aria-hidden />,
};

export function TemplatePickerDialog({ open, onOpenChange, onCreated }: TemplatePickerDialogProps) {
  const [templates, setTemplates] = useState<ScenarioDecisionTemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ScenarioDecisionTemplateSummary | null>(
    null
  );
  const [scenarioName, setScenarioName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedTemplate(null);
    setScenarioName('');
    setError(null);
    setIsLoading(true);
    listScenarioTemplates()
      .then(setTemplates)
      .catch(() => setError('Failed to load templates.'))
      .finally(() => setIsLoading(false));
  }, [open]);

  const handleSelect = (template: ScenarioDecisionTemplateSummary) => {
    setSelectedTemplate(template);
    setScenarioName(template.name);
  };

  const handleCreate = async () => {
    if (!selectedTemplate || scenarioName.trim() === '') return;
    setIsCreating(true);
    setError(null);
    try {
      const scenario = await createProfileScenarioFromTemplate(
        selectedTemplate.id,
        scenarioName.trim()
      );
      onCreated(scenario);
      onOpenChange(false);
    } catch {
      setError('Failed to create scenario from template. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-ds-surface rounded-card">
        <DialogHeader>
          <DialogTitle>Start from a Template</DialogTitle>
          <DialogDescription>
            Pick a predefined set of decisions as a starting point. You can edit any decision
            afterwards.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : selectedTemplate ? (
          <div className="space-y-4 py-2">
            <div className="rounded-card bg-ds-surface-raised p-4">
              <p className="text-sm font-semibold">{selectedTemplate.name}</p>
              <p className="text-xs text-ds-on-surface-variant mt-1">
                {selectedTemplate.description}
              </p>
            </div>
            <div>
              <Label htmlFor="template-scenario-name">Scenario Name</Label>
              <Input
                id="template-scenario-name"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Name this scenario"
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
              <Button
                variant="outline"
                onClick={() => setSelectedTemplate(null)}
                disabled={isCreating}
              >
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
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {error && <p className="col-span-full text-sm text-ds-error">{error}</p>}
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-colors bg-ds-surface-raised"
                onClick={() => handleSelect(template)}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
