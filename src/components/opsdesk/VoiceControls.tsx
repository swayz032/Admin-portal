import { useState, useCallback } from 'react';
import { useOpsDesk } from '@/contexts/OpsDeskContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Mic, MicOff, Square, Volume2, VolumeX, Settings, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VoiceControls() {
  const { 
    orbState, 
    isConversationActive,
    startConversation,
    endConversation,
    interruptSpeaking,
    isElevenLabsConfigured,
    voiceSettings,
    setVoiceSettings,
  } = useOpsDesk();
  
  const [selectedMic, setSelectedMic] = useState<string>('default');
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const handleMicToggle = useCallback(() => {
    if (orbState === 'speaking') {
      // Barge-in: interrupt and switch to listening
      interruptSpeaking();
    } else if (isConversationActive) {
      // Stop listening
      endConversation();
    } else {
      // Start conversation
      startConversation();
    }
  }, [orbState, isConversationActive, startConversation, endConversation, interruptSpeaking]);
  
  const handleEndChat = useCallback(() => {
    endConversation();
  }, [endConversation]);
  
  const isProcessing = ['listening', 'thinking', 'searching_web', 'searching_files', 'querying_data', 'connecting_agents', 'drafting', 'speaking'].includes(orbState);
  
  return (
    <div className="flex items-center gap-3">
      {/* Mic toggle button */}
      <Button
        size="lg"
        variant={isConversationActive ? 'default' : 'outline'}
        className={cn(
          'gap-2',
          isConversationActive && 'bg-primary hover:bg-primary/90'
        )}
        onClick={handleMicToggle}
      >
        {isConversationActive ? (
          <>
            <Mic className="h-5 w-5 animate-pulse" />
            Stop Listening
          </>
        ) : (
          <>
            <Mic className="h-5 w-5" />
            Start Conversation
          </>
        )}
      </Button>
      
      {/* End Chat button (danger) */}
      <Button
        size="lg"
        variant="destructive"
        className="gap-2"
        onClick={handleEndChat}
        disabled={!isConversationActive && !isProcessing}
      >
        <PhoneOff className="h-4 w-4" />
        End Chat
      </Button>
      
      {/* Settings drawer trigger */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetTrigger asChild>
          <Button size="icon" variant="ghost" className="text-text-secondary">
            <Settings className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent className="bg-card border-border">
          <SheetHeader>
            <SheetTitle className="text-text-primary">Voice Settings</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-6 mt-6">
            {/* Mute toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="mute" className="text-sm text-text-secondary flex items-center gap-2">
                {voiceSettings.isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                Mute Audio Output
              </Label>
              <Switch
                id="mute"
                checked={voiceSettings.isMuted}
                onCheckedChange={(checked) => setVoiceSettings({ isMuted: checked })}
              />
            </div>
            
            {/* Auto-speak toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-speak" className="text-sm text-text-secondary">
                Auto-speak Responses
              </Label>
              <Switch
                id="auto-speak"
                checked={voiceSettings.autoSpeak}
                onCheckedChange={(checked) => setVoiceSettings({ autoSpeak: checked })}
              />
            </div>
            
            {/* Microphone selection */}
            <div className="space-y-2">
              <Label className="text-xs text-text-tertiary">Microphone</Label>
              <Select value={selectedMic} onValueChange={setSelectedMic}>
                <SelectTrigger className="bg-surface-1 border-border">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="default">Default Microphone</SelectItem>
                  <SelectItem value="none" disabled>
                    <span className="text-text-tertiary">No other microphones detected</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Voice provider status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-1 border border-border">
              <span className="text-sm text-text-secondary">Voice Provider</span>
              {isElevenLabsConfigured ? (
                <span className="text-sm text-success font-medium">ElevenLabs</span>
              ) : (
                <span className="text-sm text-text-tertiary">ElevenLabs not configured</span>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
