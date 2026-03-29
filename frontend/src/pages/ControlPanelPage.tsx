import { useState, useEffect, useCallback } from 'react';
import {
  Lock, Save, Trash2, Download, Upload, Edit3, Check, X, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger, DialogClose
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useStorageUsage } from '@/hooks/useStorageUsage';
import type { LLMSettings } from '@/lib/api';
import { toast } from 'sonner';
import Papa from 'papaparse';

interface SampleReview {
  star_rating: number;
  review_text: string;
}

interface OutputReview {
  asin: string;
  product_name: string;
  star_rating: number;
  review_text: string;
}

export default function ControlPanelPage() {
  const [llmSettings, setLLMSettings] = useLocalStorage<LLMSettings>('llmSettings', {
    model: 'Qwen/Qwen3-32B',
    temperature: 0.75,
    max_tokens: 1024,
    top_p: 0.9,
    frequency_penalty: 0.3,
    presence_penalty: 0.1,
  });
  const [sampleReviews, setSampleReviews] = useLocalStorage<SampleReview[]>('sampleReviews', []);
  const [outputReviews, setOutputReviews] = useLocalStorage<OutputReview[]>('outputReviews', []);
  const [outputFormat, setOutputFormat] = useLocalStorage<string>('outputFormat', 'csv');
  const [settingsLocked, setSettingsLocked] = useState(true);
  const [editingSampleIdx, setEditingSampleIdx] = useState<number | null>(null);
  const [editingSampleText, setEditingSampleText] = useState('');
  const [editingOutputIdx, setEditingOutputIdx] = useState<number | null>(null);
  const [editingOutputText, setEditingOutputText] = useState('');
  const { usage, calculateUsage, formatBytes } = useStorageUsage();

  useEffect(() => {
    calculateUsage();
  }, [calculateUsage]);

  const handleSettingsChange = useCallback((key: keyof LLMSettings, value: string | number) => {
    setLLMSettings((prev) => ({ ...prev, [key]: value }));
  }, [setLLMSettings]);

  const handleUnlockSettings = useCallback(() => {
    setSettingsLocked(false);
    toast.info('LLM settings unlocked');
  }, []);

  const handleSaveSettings = useCallback(() => {
    setSettingsLocked(true);
    toast.success('Settings saved');
  }, []);

  // Sample reviews management
  const handleEditSample = useCallback((idx: number) => {
    setEditingSampleIdx(idx);
    setEditingSampleText(sampleReviews[idx].review_text);
  }, [sampleReviews]);

  const handleSaveSampleEdit = useCallback(() => {
    if (editingSampleIdx === null) return;
    setSampleReviews((prev) => {
      const updated = [...prev];
      updated[editingSampleIdx] = { ...updated[editingSampleIdx], review_text: editingSampleText };
      return updated;
    });
    setEditingSampleIdx(null);
    toast.success('Sample review updated');
  }, [editingSampleIdx, editingSampleText, setSampleReviews]);

  const handleDeleteSample = useCallback((idx: number) => {
    setSampleReviews((prev) => prev.filter((_, i) => i !== idx));
    toast.success('Sample review deleted');
  }, [setSampleReviews]);

  const handleDownloadSamples = useCallback(() => {
    const csv = Papa.unparse(sampleReviews.map((r) => ({
      star_rating: r.star_rating,
      review_text: r.review_text,
    })));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_reviews.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Sample reviews downloaded');
  }, [sampleReviews]);

  const handleUploadSamples = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, unknown>[];
        const parsed: SampleReview[] = data
          .filter((row) => row.star_rating && row.review_text)
          .map((row) => ({
            star_rating: Number(row.star_rating),
            review_text: String(row.review_text),
          }));
        if (parsed.length === 0) {
          toast.error('No valid rows found');
          return;
        }
        // Dedupe merge
        const existing = new Set(sampleReviews.map((r) => `${r.star_rating}|${r.review_text}`));
        const newOnes = parsed.filter((r) => !existing.has(`${r.star_rating}|${r.review_text}`));
        setSampleReviews((prev) => [...prev, ...newOnes]);
        toast.success(`Merged ${newOnes.length} new reviews (${parsed.length - newOnes.length} duplicates skipped)`);
      },
    });
    e.target.value = '';
  }, [sampleReviews, setSampleReviews]);

  // Output reviews management
  const handleEditOutput = useCallback((idx: number) => {
    setEditingOutputIdx(idx);
    setEditingOutputText(outputReviews[idx].review_text);
  }, [outputReviews]);

  const handleSaveOutputEdit = useCallback(() => {
    if (editingOutputIdx === null) return;
    setOutputReviews((prev) => {
      const updated = [...prev];
      updated[editingOutputIdx] = { ...updated[editingOutputIdx], review_text: editingOutputText };
      return updated;
    });
    setEditingOutputIdx(null);
    toast.success('Output review updated');
  }, [editingOutputIdx, editingOutputText, setOutputReviews]);

  const handleDeleteOutput = useCallback((idx: number) => {
    setOutputReviews((prev) => prev.filter((_, i) => i !== idx));
    toast.success('Output review deleted');
  }, [setOutputReviews]);

  const handleClearAll = useCallback(() => {
    localStorage.clear();
    window.location.reload();
  }, []);

  const usagePercent = (usage.used / usage.limit) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Control Panel</h1>
        <p className="text-muted-foreground mt-1">Manage settings, data, and review history.</p>
      </div>

      <Tabs defaultValue="llm" className="space-y-4">
        <TabsList className="w-full overflow-x-auto flex">
          <TabsTrigger value="llm" className="flex-shrink-0">LLM</TabsTrigger>
          <TabsTrigger value="samples" className="flex-shrink-0">Samples ({sampleReviews.length})</TabsTrigger>
          <TabsTrigger value="output" className="flex-shrink-0">Output ({outputReviews.length})</TabsTrigger>
          <TabsTrigger value="storage" className="flex-shrink-0">Storage</TabsTrigger>
        </TabsList>

        {/* LLM Settings Tab */}
        <TabsContent value="llm">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>LLM Configuration</CardTitle>
                  <CardDescription>Configure the AI model and generation parameters</CardDescription>
                </div>
                {settingsLocked ? (
                  <Dialog>
                    <DialogTrigger>
                      <Button variant="outline" size="sm">
                        <Lock className="h-4 w-4 mr-1" />
                        Unlock
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Unlock LLM Settings?</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to edit LLM settings? Incorrect values may cause generation failures.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <DialogClose>
                          <Button onClick={handleUnlockSettings}>Unlock</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button size="sm" onClick={handleSaveSettings}>
                    <Save className="h-4 w-4 mr-1" />
                    Save & Lock
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="sk-..."
                    value={llmSettings.api_key || ''}
                    onChange={(e) => handleSettingsChange('api_key', e.target.value)}
                    disabled={settingsLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-url">API URL</Label>
                  <Input
                    id="api-url"
                    placeholder="https://api.featherless.ai/v1"
                    value={llmSettings.api_url || ''}
                    onChange={(e) => handleSettingsChange('api_url', e.target.value)}
                    disabled={settingsLocked}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="Enter model name..."
                  value={llmSettings.model || ''}
                  onChange={(e) => handleSettingsChange('model', e.target.value)}
                  disabled={settingsLocked}
                />
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Temperature: {llmSettings.temperature ?? 0.7}</Label>
                  <Slider
                    value={[llmSettings.temperature ?? 0.7]}
                    min={0}
                    max={2}
                    step={0.1}
                    onValueChange={(v) => handleSettingsChange('temperature', Array.isArray(v) ? v[0] : v)}
                    disabled={settingsLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens: {llmSettings.max_tokens ?? 1024}</Label>
                  <Slider
                    value={[llmSettings.max_tokens ?? 1024]}
                    min={64}
                    max={4096}
                    step={64}
                    onValueChange={(v) => handleSettingsChange('max_tokens', Array.isArray(v) ? v[0] : v)}
                    disabled={settingsLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Top P: {llmSettings.top_p ?? 1.0}</Label>
                  <Slider
                    value={[llmSettings.top_p ?? 1.0]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueChange={(v) => handleSettingsChange('top_p', Array.isArray(v) ? v[0] : v)}
                    disabled={settingsLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frequency Penalty: {llmSettings.frequency_penalty ?? 0.0}</Label>
                  <Slider
                    value={[llmSettings.frequency_penalty ?? 0.0]}
                    min={-2}
                    max={2}
                    step={0.1}
                    onValueChange={(v) => handleSettingsChange('frequency_penalty', Array.isArray(v) ? v[0] : v)}
                    disabled={settingsLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Presence Penalty: {llmSettings.presence_penalty ?? 0.0}</Label>
                  <Slider
                    value={[llmSettings.presence_penalty ?? 0.0]}
                    min={-2}
                    max={2}
                    step={0.1}
                    onValueChange={(v) => handleSettingsChange('presence_penalty', Array.isArray(v) ? v[0] : v)}
                    disabled={settingsLocked}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sample Reviews Tab */}
        <TabsContent value="samples">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Sample Reviews</CardTitle>
                  <CardDescription>{sampleReviews.length} reviews loaded for style matching</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadSamples} disabled={sampleReviews.length === 0}>
                    <Download className="h-4 w-4 mr-1" />
                    Download CSV
                  </Button>
                  <label className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 px-3 cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Merge CSV
                    <input type="file" accept=".csv" className="hidden" onChange={handleUploadSamples} />
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sampleReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No sample reviews loaded.</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {sampleReviews.map((review, idx) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">{review.star_rating} star{review.star_rating > 1 ? 's' : ''}</Badge>
                          <div className="flex gap-1">
                            {editingSampleIdx === idx ? (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveSampleEdit}>
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSampleIdx(null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditSample(idx)}>
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSample(idx)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {editingSampleIdx === idx ? (
                          <Textarea
                            value={editingSampleText}
                            onChange={(e) => setEditingSampleText(e.target.value)}
                            rows={3}
                          />
                        ) : (
                          <p className="text-sm line-clamp-3">{review.review_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Output Reviews Tab */}
        <TabsContent value="output">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Output Reviews</CardTitle>
                  <CardDescription>{outputReviews.length} reviews ready for export</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="format-toggle" className="text-sm">TXT</Label>
                    <Switch
                      id="format-toggle"
                      checked={outputFormat === 'csv'}
                      onCheckedChange={(checked) => setOutputFormat(checked ? 'csv' : 'txt')}
                    />
                    <Label htmlFor="format-toggle" className="text-sm">CSV</Label>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {outputReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No output reviews yet.</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {outputReviews.map((review, idx) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <Badge variant="secondary" className="flex-shrink-0">{review.asin}</Badge>
                            <span className="text-sm font-medium truncate">{review.product_name}</span>
                            <Badge className="flex-shrink-0">{review.star_rating} star{review.star_rating > 1 ? 's' : ''}</Badge>
                          </div>
                          <div className="flex gap-1">
                            {editingOutputIdx === idx ? (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveOutputEdit}>
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingOutputIdx(null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditOutput(idx)}>
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteOutput(idx)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {editingOutputIdx === idx ? (
                          <Textarea
                            value={editingOutputText}
                            onChange={(e) => setEditingOutputText(e.target.value)}
                            rows={3}
                          />
                        ) : (
                          <p className="text-sm line-clamp-3">{review.review_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle>Browser Storage</CardTitle>
              <CardDescription>All data is stored in your browser's localStorage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Usage</span>
                  <span>{formatBytes(usage.used)} / {formatBytes(usage.limit)}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${usagePercent > 80 ? 'bg-destructive' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
                {usagePercent > 80 && (
                  <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Storage is almost full. Consider exporting and clearing data.
                  </p>
                )}
              </div>

              <Separator />

              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Sample Reviews</span>
                  <span>{sampleReviews.length} items</span>
                </div>
                <div className="flex justify-between">
                  <span>Output Reviews</span>
                  <span>{outputReviews.length} items</span>
                </div>
              </div>

              <Separator />

              <Dialog>
                <DialogTrigger>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All Data
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Clear All Data?</DialogTitle>
                    <DialogDescription>
                      This will permanently delete all stored data including settings, sample reviews, output reviews, and product lists. This cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <DialogClose>
                      <Button variant="destructive" onClick={handleClearAll}>Delete Everything</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
