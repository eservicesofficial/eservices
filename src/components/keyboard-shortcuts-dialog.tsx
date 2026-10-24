'use client';

import { useState } from 'react';
import {
  Keyboard,
  Search,
  FileText,
  Wallet,
  BookOpen,
  Users,
  Calculator,
  Package,
  BarChart3,
  Settings,
  History,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

const SHORTCUTS = [
  { keys: ['⌘', 'K'], description: 'Open global search', icon: <Search className="size-3.5" /> },
  { keys: ['⌘', '1'], description: 'Go to Dashboard', icon: <Keyboard className="size-3.5" /> },
  { keys: ['⌘', '2'], description: 'New Invoice', icon: <FileText className="size-3.5" /> },
  { keys: ['⌘', '3'], description: 'Bill History', icon: <History className="size-3.5" /> },
  { keys: ['⌘', '4'], description: 'Cash Manager', icon: <Wallet className="size-3.5" /> },
  { keys: ['⌘', '5'], description: 'Khata Book', icon: <BookOpen className="size-3.5" /> },
  { keys: ['⌘', '6'], description: 'Staff & Attendance', icon: <Users className="size-3.5" /> },
  { keys: ['⌘', '7'], description: 'Calculator', icon: <Calculator className="size-3.5" /> },
  { keys: ['⌘', '8'], description: 'Item Management', icon: <Package className="size-3.5" /> },
  { keys: ['⌘', '9'], description: 'Reports', icon: <BarChart3 className="size-3.5" /> },
  { keys: ['⌘', '0'], description: 'Settings', icon: <Settings className="size-3.5" /> },
  { keys: ['⌘', 'Enter'], description: 'Submit / Generate Invoice', icon: <FileText className="size-3.5" /> },
  { keys: ['?'], description: 'Show this help dialog', icon: <Keyboard className="size-3.5" /> },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(true)}
          >
            <Keyboard className="h-5 w-5" />
            <span className="sr-only">Keyboard shortcuts</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Keyboard shortcuts (?)
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="size-5 text-green-600 dark:text-green-400" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Navigate faster with these keyboard shortcuts
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
            {SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.description}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-muted-foreground">{shortcut.icon}</span>
                  <span className="text-sm text-foreground">{shortcut.description}</span>
                </div>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, i) => (
                    <span key={i}>
                      {i > 0 && <span className="text-xs text-muted-foreground mx-0.5">+</span>}
                      <kbd className="pointer-events-none inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
                        {key}
                      </kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <p className="text-xs text-muted-foreground">
              Press <kbd className="pointer-events-none inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground mx-0.5">?</kbd> to toggle this dialog
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
