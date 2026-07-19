// Trigger and content share one Motion layoutId, so opening the popover is
// a genuine FLIP layout animation from the trigger's rect into the
// content's rect (a real shape morph — grow + reshape), not a fade-in box
// floating near the button. Adapted from the common "morphing popover"
// pattern (motion/react) for this project: relative imports instead of a
// "@/" alias (this repo doesn't have one), no shadcn/ui Button/Input deps,
// and a small inline click-outside hook instead of a shared hooks/ file
// (matching how AuthGate/Primitives.tsx each roll their own already).
import {
  useState,
  useId,
  useRef,
  useEffect,
  createContext,
  useContext,
  isValidElement,
} from 'react';
import {
  AnimatePresence,
  MotionConfig,
  motion,
  Transition,
  Variants,
} from 'motion/react';
import { cn } from '../../lib/utils';

const TRANSITION: Transition = {
  type: 'spring',
  bounce: 0.1,
  duration: 0.4,
};

type MorphingPopoverContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  uniqueId: string;
  variants?: Variants;
};

const MorphingPopoverContext = createContext<MorphingPopoverContextValue | null>(null);

function useClickOutside<T extends HTMLElement>(ref: React.RefObject<T>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

function usePopoverLogic({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
}: {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const uniqueId = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const isOpen = controlledOpen ?? uncontrolledOpen;

  const open = () => {
    if (controlledOpen === undefined) setUncontrolledOpen(true);
    onOpenChange?.(true);
  };

  const close = () => {
    if (controlledOpen === undefined) setUncontrolledOpen(false);
    onOpenChange?.(false);
  };

  return { isOpen, open, close, uniqueId };
}

// Exposed so anything nested inside <MorphingPopoverContent> (e.g. a link
// that should dismiss the menu on click, not just on outside-click/Escape)
// can call close() itself.
export function useMorphingPopover() {
  const context = useContext(MorphingPopoverContext);
  if (!context) throw new Error('useMorphingPopover must be used within MorphingPopover');
  return context;
}

export type MorphingPopoverProps = {
  children: React.ReactNode;
  transition?: Transition;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variants?: Variants;
  className?: string;
} & React.ComponentProps<'div'>;

export function MorphingPopover({
  children,
  transition = TRANSITION,
  defaultOpen,
  open,
  onOpenChange,
  variants,
  className,
  ...props
}: MorphingPopoverProps) {
  const popoverLogic = usePopoverLogic({ defaultOpen, open, onOpenChange });

  return (
    <MorphingPopoverContext.Provider value={{ ...popoverLogic, variants }}>
      <MotionConfig transition={transition}>
        <div
          className={cn('relative flex items-center justify-center', className)}
          key={popoverLogic.uniqueId}
          {...props}
        >
          {children}
        </div>
      </MotionConfig>
    </MorphingPopoverContext.Provider>
  );
}

export type MorphingPopoverTriggerProps = {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
} & React.ComponentProps<typeof motion.button>;

export function MorphingPopoverTrigger({
  children,
  className,
  asChild = false,
  ...props
}: MorphingPopoverTriggerProps) {
  const context = useContext(MorphingPopoverContext);
  if (!context) throw new Error('MorphingPopoverTrigger must be used within MorphingPopover');

  if (asChild && isValidElement(children)) {
    const MotionComponent = motion.create(children.type as React.ForwardRefExoticComponent<any>);
    const childProps = children.props as Record<string, unknown>;

    return (
      <MotionComponent
        {...childProps}
        onClick={context.open}
        layoutId={`popover-trigger-${context.uniqueId}`}
        className={childProps.className}
        key={context.uniqueId}
        aria-expanded={context.isOpen}
        aria-controls={`popover-content-${context.uniqueId}`}
      />
    );
  }

  return (
    <motion.div key={context.uniqueId} layoutId={`popover-trigger-${context.uniqueId}`} onClick={context.open}>
      <motion.button
        {...props}
        layoutId={`popover-label-${context.uniqueId}`}
        key={context.uniqueId}
        className={className}
        aria-expanded={context.isOpen}
        aria-controls={`popover-content-${context.uniqueId}`}
      >
        {children}
      </motion.button>
    </motion.div>
  );
}

export type MorphingPopoverContentProps = {
  children: React.ReactNode;
  className?: string;
} & React.ComponentProps<typeof motion.div>;

export function MorphingPopoverContent({ children, className, ...props }: MorphingPopoverContentProps) {
  const context = useContext(MorphingPopoverContext);
  if (!context) throw new Error('MorphingPopoverContent must be used within MorphingPopover');

  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, context.close);

  useEffect(() => {
    if (!context.isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') context.close();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [context.isOpen, context.close]);

  return (
    <AnimatePresence>
      {context.isOpen && (
        <motion.div
          {...props}
          ref={ref}
          layoutId={`popover-trigger-${context.uniqueId}`}
          key={context.uniqueId}
          id={`popover-content-${context.uniqueId}`}
          role="dialog"
          aria-modal="true"
          className={cn(
            'absolute overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/95 p-2 text-neutral-200 shadow-2xl shadow-black/40 backdrop-blur-xl',
            className
          )}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={context.variants}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
