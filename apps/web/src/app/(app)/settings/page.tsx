'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Shield, Database, Cpu, Check, UserCheck } from 'lucide-react';
import { AccountSecuritySettings } from '@/components/features/settings/account-security-settings';

export default function SettingsPage() {
  const [faceThreshold, setFaceThreshold] = useState([60]);
  const [reidThreshold, setReidThreshold] = useState([50]);
  const [autoDlq, setAutoDlq] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Settings &amp; Security</h1>
          <p className="text-xs text-muted-foreground">
            Manage operator credentials, MFA, session security, neural model parameters, and vector thresholds
          </p>
        </div>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 border">
          <TabsTrigger value="account" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <UserCheck className="h-3.5 w-3.5" />
            Account &amp; Security
          </TabsTrigger>
          <TabsTrigger value="platform" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <Cpu className="h-3.5 w-3.5" />
            Platform &amp; Neural Models
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <AccountSecuritySettings />
        </TabsContent>

        <TabsContent value="platform" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={handleSave} size="sm" className="h-8 gap-1.5 font-medium">
              {saved ? <Check className="h-4 w-4 text-emerald-400" /> : <Settings className="h-4 w-4" />}
              {saved ? 'Settings Saved' : 'Save Platform Settings'}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Model Version Invariants */}
            <Card>
              <CardHeader className="p-4 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Active Neural Models (model_version)</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Every stored embedding record strictly tags its source model version
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs">Face Recognition Model (512-dim)</Label>
                  <Input disabled value="arcface-r100-v1" className="h-8 font-mono bg-muted/40" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Person Re-ID Model (512-dim)</Label>
                  <Input disabled value="osnet-ain-x1.0-v1" className="h-8 font-mono bg-muted/40" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Person Detector Model</Label>
                  <Input disabled value="yolov8n-v1" className="h-8 font-mono bg-muted/40" />
                </div>
                <div className="rounded border bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <strong>Strict Separation Rule:</strong> Face vectors (512d) and Re-ID vectors (512d) are stored
                  in separate Pinecone indexes and are never concatenated.
                </div>
              </CardContent>
            </Card>

            {/* Vector DB Thresholds */}
            <Card>
              <CardHeader className="p-4 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Pinecone Cosine Distance Thresholds</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Cosine similarity cutoff for generating &apos;Possible match&apos; candidate hits
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-5 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Default Face Cosine Threshold:</span>
                    <span className="font-mono font-bold">{faceThreshold[0]}%</span>
                  </div>
                  <Slider value={faceThreshold} onValueChange={setFaceThreshold} min={30} max={90} step={5} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Default Re-ID Cosine Threshold:</span>
                    <span className="font-mono font-bold">{reidThreshold[0]}%</span>
                  </div>
                  <Slider value={reidThreshold} onValueChange={setReidThreshold} min={30} max={90} step={5} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="space-y-0.5">
                    <span className="font-medium text-foreground">Auto-route failures to *.dlq</span>
                    <p className="text-[10px] text-muted-foreground">
                      Send poison pill messages to Dead Letter Queue after 3 failed retries
                    </p>
                  </div>
                  <Switch checked={autoDlq} onCheckedChange={setAutoDlq} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
