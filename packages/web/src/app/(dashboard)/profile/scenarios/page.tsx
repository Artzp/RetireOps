'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Copy,
  Edit,
  Lock,
  CheckCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Settings,
  Play,
  Loader2,
  BarChart2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import {
  listProfileScenarios,
  cloneProfileScenario,
  renameProfileScenario,
  deleteProfileScenario,
  runProfileScenario,
} from '@/lib/api/profile-scenarios';
import type { ProfileScenarioListItem, ProfileScenarioStatus } from '@/types/profile-scenario';
import { NewScenarioDialog } from '@/components/profile/scenarios/NewScenarioDialog';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ScenariosPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [scenarios, setScenarios] = useState<ProfileScenarioListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [newScenarioDialogOpen, setNewScenarioDialogOpen] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareHintDismissed, setCompareHintDismissed] = useState(true);

  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompareHintDismissed(localStorage.getItem('scenarios.compareHintDismissed') === '1');
  }, []);

  const dismissCompareHint = () => {
    localStorage.setItem('scenarios.compareHintDismissed', '1');
    setCompareHintDismissed(true);
  };

  const loadScenarios = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await listProfileScenarios();
      setScenarios(data);
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('not found')) {
        setError('no-profile');
      } else {
        setError('Failed to load scenarios. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScenarios();
  }, [loadScenarios]);

  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingId]);

  const handleClone = async (scenario: ProfileScenarioListItem) => {
    try {
      const clone = await cloneProfileScenario(scenario.id);
      setScenarios((prev) => [...prev, clone]);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to clone scenario. Please try again.' });
    }
  };

  const handleRenameStart = (scenario: ProfileScenarioListItem) => {
    if (scenario.is_base) return;
    setEditingId(scenario.id);
    setEditName(scenario.name);
  };

  const handleRenameSubmit = async () => {
    if (!editingId) return;
    const originalScenario = scenarios.find((s) => s.id === editingId);
    if (!originalScenario) {
      setEditingId(null);
      return;
    }
    if (editName.trim() === '' || editName === originalScenario.name) {
      setEditingId(null);
      return;
    }
    const idToRename = editingId;
    setEditingId(null);
    try {
      const updated = await renameProfileScenario(idToRename, editName.trim());
      setScenarios((prev) => prev.map((s) => (s.id === idToRename ? updated : s)));
    } catch {
      toast({ variant: 'destructive', title: 'Failed to rename scenario. Please try again.' });
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteProfileScenario(id);
      setScenarios((prev) => prev.filter((s) => s.id !== id));
      setDeleteTarget(null);
      setDeletingId(null);
      toast({ title: 'Scenario deleted.' });
    } catch {
      setDeletingId(null);
      setDeleteTarget(null);
      toast({ variant: 'destructive', title: 'Failed to delete scenario. Please try again.' });
    }
  };

  const handleRun = async (scenarioId: string) => {
    setRunningId(scenarioId);
    try {
      await runProfileScenario(scenarioId);
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === scenarioId
            ? {
                ...s,
                status: 'completed' as ProfileScenarioStatus,
                calculated_at: new Date().toISOString(),
              }
            : s
        )
      );
      router.push(`/profile/scenarios/${scenarioId}/results`);
    } catch {
      toast({ variant: 'destructive', title: 'Projection failed. Please try again.' });
      setRunningId(null);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getStatusBadge = (status: ProfileScenarioStatus, scenarioName: string) => {
    const baseClass = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-normal';
    switch (status) {
      case 'completed':
        return (
          <span className={`${baseClass} bg-ds-primary-container text-ds-on-primary-container`}>
            <CheckCircle className="h-3 w-3" />
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className={`${baseClass} bg-ds-tertiary-container text-ds-on-tertiary-container`}>
            <Clock className="h-3 w-3" />
            Not yet run
          </span>
        );
      case 'stale':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`${baseClass} bg-ds-secondary-container text-ds-on-secondary-container cursor-default`}
              >
                <RefreshCw className="h-3 w-3" />
                Outdated
              </span>
            </TooltipTrigger>
            <TooltipContent>Profile was edited; results may be outdated</TooltipContent>
          </Tooltip>
        );
      case 'failed':
        return (
          <span className={`${baseClass} bg-ds-error-container text-ds-on-error-container`}>
            <AlertCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return <span className={baseClass}>{scenarioName}</span>;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-32 bg-ds-surface-raised animate-pulse rounded-card" />
          <div className="h-10 w-36 bg-ds-surface-raised animate-pulse rounded-card" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-ds-surface-raised animate-pulse rounded-card h-[88px]" />
          ))}
        </div>
      </div>
    );
  }

  // Error state — no profile (404)
  if (error === 'no-profile') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold font-display text-ds-on-background">Scenarios</h1>
        </div>
        <div className="bg-ds-surface rounded-card p-12 text-center">
          <h3 className="text-base font-semibold text-ds-on-background">No profile found</h3>
          <p className="text-sm text-ds-on-surface-variant mt-2">
            Complete your profile setup to see scenarios.
          </p>
          <Link href="/profile">
            <Button className="bg-ds-primary text-ds-on-primary rounded-button mt-4">
              Go to Profile
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Error state — generic
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold font-display text-ds-on-background">Scenarios</h1>
        </div>
        <div className="bg-ds-error-container text-ds-on-error-container rounded-card p-6">
          <p className="text-sm">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => void loadScenarios()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const completedCount = scenarios.filter((s) => s.status === 'completed').length;
  const showCompareHint = !compareHintDismissed && completedCount >= 2 && selectedIds.size === 0;
  const anyRunning = runningId !== null;

  return (
    <div className={`space-y-6${selectedIds.size >= 1 ? ' pb-20' : ''}`}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold font-display text-ds-on-background">Scenarios</h1>
        <Button
          className="bg-ds-primary text-ds-on-primary rounded-button"
          onClick={() => setNewScenarioDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Scenario
        </Button>
      </div>

      {/* Compare hint */}
      {showCompareHint && (
        <div className="flex items-center justify-between gap-2 text-sm text-ds-on-surface-variant">
          <span>Tip: select 2 or more completed scenarios to compare side-by-side.</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={dismissCompareHint}
            aria-label="Dismiss tip"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Scenario list */}
      <TooltipProvider>
        <div className="grid gap-4">
          {scenarios.map((scenario) => {
            const isThisRunning = runningId === scenario.id;
            const isCompleted = scenario.status === 'completed';
            const isStale = scenario.status === 'stale';
            const cardNavigatesToResults =
              (isCompleted || isStale) && !isThisRunning && editingId !== scenario.id;
            const goToResults = () => {
              router.push(`/profile/scenarios/${scenario.id}/results`);
            };

            const renderPrimaryAction = () => {
              if (isThisRunning) {
                return (
                  <Button disabled className="bg-ds-primary text-ds-on-primary rounded-button">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running…
                  </Button>
                );
              }
              switch (scenario.status) {
                case 'pending':
                  return (
                    <Button
                      className="bg-ds-primary text-ds-on-primary rounded-button"
                      disabled={anyRunning}
                      onClick={() => void handleRun(scenario.id)}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Run projection
                    </Button>
                  );
                case 'completed':
                  return (
                    <Button
                      asChild
                      variant="outline"
                      className="rounded-button border-ds-primary text-ds-primary hover:bg-ds-primary-container hover:text-ds-on-primary-container"
                    >
                      <Link href={`/profile/scenarios/${scenario.id}/results`}>
                        <BarChart2 className="mr-2 h-4 w-4" />
                        View results
                      </Link>
                    </Button>
                  );
                case 'stale':
                  return (
                    <Button
                      className="bg-ds-primary text-ds-on-primary rounded-button"
                      disabled={anyRunning}
                      onClick={() => void handleRun(scenario.id)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Re-run
                    </Button>
                  );
                case 'failed':
                  return (
                    <Button
                      className="bg-ds-primary text-ds-on-primary rounded-button"
                      disabled={anyRunning}
                      onClick={() => void handleRun(scenario.id)}
                    >
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Try again
                    </Button>
                  );
                default:
                  return null;
              }
            };

            return (
              <div
                key={scenario.id}
                className={`flex items-center gap-3${deletingId === scenario.id ? ' opacity-50 pointer-events-none' : ''}${isThisRunning ? ' opacity-75' : ''}`}
              >
                {/* Checkbox */}
                <div className="flex items-center h-11 w-11 justify-center flex-shrink-0">
                  {(() => {
                    const isSelected = selectedIds.has(scenario.id);
                    const maxReached = selectedIds.size >= 4 && !isSelected;
                    const disabled = !isCompleted || maxReached;
                    const tooltipText = !isCompleted
                      ? 'Run this scenario before comparing'
                      : maxReached
                        ? 'Maximum 4 scenarios'
                        : '';

                    if (disabled) {
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Checkbox
                                disabled
                                checked={isSelected}
                                className="opacity-50 cursor-not-allowed"
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{tooltipText}</TooltipContent>
                        </Tooltip>
                      );
                    }
                    return (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(scenario.id)}
                        className={isSelected ? '' : 'opacity-70'}
                      />
                    );
                  })()}
                </div>

                {/* Card */}
                <div
                  className={`group flex-1 bg-ds-surface rounded-card p-6 hover:bg-ds-surface-raised transition-colors${cardNavigatesToResults ? ' cursor-pointer' : ''}`}
                  onClick={cardNavigatesToResults ? goToResults : undefined}
                  role={cardNavigatesToResults ? 'link' : undefined}
                  tabIndex={cardNavigatesToResults ? 0 : undefined}
                  onKeyDown={
                    cardNavigatesToResults
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            goToResults();
                          }
                        }
                      : undefined
                  }
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    {/* Left: name + badge + date */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {scenario.is_base && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-ds-surface-raised text-ds-on-surface-variant cursor-default"
                                aria-label="Base Scenario — your current profile run as-is. Cannot be renamed or deleted."
                              >
                                <Lock className="h-3 w-3" />
                                Base
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Your current profile run as-is. Can&apos;t be renamed or deleted — use
                              Clone to explore changes.
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {editingId === scenario.id ? (
                          <Input
                            ref={renameInputRef}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => void handleRenameSubmit()}
                            onKeyDown={handleRenameKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-48 text-base font-semibold"
                          />
                        ) : (
                          <>
                            <span className="text-base font-semibold text-ds-on-surface">
                              {scenario.name}
                            </span>
                            {!scenario.is_base && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameStart(scenario);
                                }}
                                aria-label={`Rename ${scenario.name}`}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                        {getStatusBadge(scenario.status, scenario.name)}
                      </div>
                      <div className="text-sm text-ds-on-surface-variant">
                        {(() => {
                          const created = formatDate(scenario.created_at);
                          if (!scenario.calculated_at) return `Created ${created}`;
                          const lastRun = formatDate(scenario.calculated_at);
                          return lastRun === created
                            ? `Last run: ${lastRun}`
                            : `Last run: ${lastRun} · Created ${created}`;
                        })()}
                      </div>
                    </div>

                    {/* Right: primary action + dropdown */}
                    <div
                      className="flex gap-2 items-center self-end md:self-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {renderPrimaryAction()}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Scenario options">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isThisRunning ? (
                            <DropdownMenuItem disabled>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Running...
                            </DropdownMenuItem>
                          ) : scenario.status === 'completed' || scenario.status === 'stale' ? (
                            <DropdownMenuItem
                              onClick={() => void handleRun(scenario.id)}
                              disabled={anyRunning}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Re-run
                            </DropdownMenuItem>
                          ) : scenario.status === 'failed' ? (
                            <DropdownMenuItem
                              onClick={() => void handleRun(scenario.id)}
                              disabled={anyRunning}
                            >
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Try again
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => void handleRun(scenario.id)}
                              disabled={anyRunning}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Run Projection
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/profile/scenarios/${scenario.id}/edit`}>
                              <Settings className="mr-2 h-4 w-4" />
                              Edit Decisions
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleClone(scenario)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Clone
                          </DropdownMenuItem>
                          {scenario.is_base ? (
                            <DropdownMenuItem disabled>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center w-full cursor-not-allowed">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Rename
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Base Scenario cannot be renamed or deleted
                                </TooltipContent>
                              </Tooltip>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleRenameStart(scenario)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {scenario.is_base ? (
                            <DropdownMenuItem disabled>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center w-full cursor-not-allowed text-ds-error">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Base Scenario cannot be renamed or deleted
                                </TooltipContent>
                              </Tooltip>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-ds-error focus:bg-ds-error-container focus:text-ds-error"
                              onClick={() =>
                                setDeleteTarget({ id: scenario.id, name: scenario.name })
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sticky footer for comparison selection */}
        {selectedIds.size >= 1 && (
          <div className="fixed bottom-0 left-0 lg:left-64 right-0 h-14 bg-ds-inverse-surface flex items-center justify-between px-6 z-40">
            <span className="text-sm font-semibold text-ds-inverse-on-surface">
              {selectedIds.size} scenario{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            {selectedIds.size >= 2 ? (
              <Button
                className="bg-ds-primary text-ds-on-primary rounded-button"
                onClick={() =>
                  router.push(`/profile/scenarios/compare?ids=${Array.from(selectedIds).join(',')}`)
                }
              >
                <BarChart2 className="mr-2 h-4 w-4" />
                Compare {selectedIds.size} scenarios
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      disabled
                      className="bg-ds-primary text-ds-on-primary rounded-button opacity-50"
                    >
                      <BarChart2 className="mr-2 h-4 w-4" />
                      Compare scenarios
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Select at least 2 to compare</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </TooltipProvider>

      {/* AlertDialog for delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="bg-ds-surface rounded-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-ds-error text-ds-on-error rounded-button hover:bg-ds-error/90"
              onClick={() => {
                if (deleteTarget) {
                  void handleDelete(deleteTarget.id);
                }
              }}
              disabled={deletingId !== null}
            >
              {deletingId ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Scenario'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NewScenarioDialog
        open={newScenarioDialogOpen}
        onOpenChange={setNewScenarioDialogOpen}
        onCreated={(created) => {
          setScenarios((prev) => [...prev, created]);
          toast({ title: 'Scenario created successfully.' });
        }}
      />
    </div>
  );
}
