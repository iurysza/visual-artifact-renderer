"use client"

import { useState } from "react"
import { toast, Toaster } from "sonner"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DefinitionList } from "@/components/ui/definition-list"
import { FileTree } from "@/components/ui/file-tree"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { Prose } from "@/components/ui/prose"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
} from "@/components/ui/avatar"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Calendar } from "@/components/ui/calendar"
import { CodeBlock } from "@/components/ui/code-block"
import { SvgDiagram } from "@/components/svg-diagram"
import { visualizerPipelineDiagram } from "@/lib/svg-diagram-example"
import { cn } from "@/lib/utils"

import {
  AlertTriangle,
  Bold,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Home,
  Italic,
  LayoutDashboard,
  LogOut,
  Mail,
  Settings,
  Star,
  Underline,
  User,
  Users,
} from "lucide-react"

const markdownExample = `# Markdown

Render long-form content with the **Prose** component. It is powered by \`react-markdown\` plus \`remark-gfm\`, so it supports GitHub-flavored Markdown.

## Text formatting

You can use **bold**, *italic*, ~~strikethrough~~, and \`inline code\`.

## Blockquotes

> Markdown is intended to be as easy-to-read and easy-to-write as is feasible.
> — *John Gruber*

## Lists

Unordered lists:

- Bullet one
- Bullet two
  - Nested bullet
  - Another nested item
- Bullet three

Numbered lists:

1. First item
2. Second item
   1. Nested numbered item
   2. Another nested item
3. Third item

Task lists (via remark-gfm):

- [x] Write the docs
- [ ] Add tests
- [ ] Ship it

## Tables

| Feature     | Supported | Notes                     |
| ----------- | :-------: | ------------------------- |
| Headings    |    ✅     | H1 through H6             |
| Lists       |    ✅     | Ordered, unordered, tasks |
| Tables      |    ✅     | GFM-style                 |
| Code blocks |    ✅     | Fenced with language hint |
| Strikethrough |  ✅     | GFM                       |

## Code

Inline code looks like \`const answer = 42\`. Fenced blocks preserve language hints:

\`\`\`typescript
function greet(name: string) {
  return \`Hello, \${name}!\`
}
\`\`\`

## Horizontal rule

---

## Links

A [labeled link](https://example.com) and an autolink: https://example.com

## Images

![Placeholder](https://placehold.co/600x120/141413/f5f0e8?text=Markdown+Image)
`

const navSections = [
  { id: "buttons", title: "Buttons" },
  { id: "badges", title: "Badges" },
  { id: "cards", title: "Cards" },
  { id: "forms", title: "Form Inputs" },
  { id: "data-display", title: "Data Display" },
  { id: "charts", title: "Charts" },
  { id: "feedback", title: "Feedback" },
  { id: "overlays", title: "Overlays" },
  { id: "navigation", title: "Navigation" },
  { id: "layout", title: "Layout" },
  { id: "toast", title: "Toast" },
  { id: "calendar", title: "Calendar" },
  { id: "markdown", title: "Markdown" },
  { id: "code-block", title: "Code Block" },
  { id: "diagrams", title: "Diagrams" },
]

function Section({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <div className="mb-6">
        <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="rounded-2xl border-[1.5px] bg-card/95 p-6 shadow-[0_10px_34px_rgba(20,20,19,0.06)] dark:shadow-black/20">
        {children}
      </div>
      <Separator className="my-10" />
    </section>
  )
}

function Subheading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-medium text-foreground">{children}</h3>
}

export default function ComponentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsibleOpen, setCollapsibleOpen] = useState(false)
  const [selectValue, setSelectValue] = useState("apple")
  const [checkboxChecked, setCheckboxChecked] = useState(true)
  const [switchChecked, setSwitchChecked] = useState(true)
  const [radioValue, setRadioValue] = useState("comfortable")
  const [sliderValue, setSliderValue] = useState([50])
  const [togglePressed, setTogglePressed] = useState(false)
  const [toggleGroupValue, setToggleGroupValue] = useState<string[]>(["bold"])
  const [dropdownChecked, setDropdownChecked] = useState(true)
  const [dropdownRadio, setDropdownRadio] = useState("dark")
  const [tabValue, setTabValue] = useState("account")
  const [accordionValue, setAccordionValue] = useState<string[]>(["item-1"])
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date())
  const [paginationPage, setPaginationPage] = useState(1)

  const chartData = [
    { month: "Jan", desktop: 186, mobile: 80 },
    { month: "Feb", desktop: 305, mobile: 200 },
    { month: "Mar", desktop: 237, mobile: 120 },
    { month: "Apr", desktop: 73, mobile: 190 },
    { month: "May", desktop: 209, mobile: 130 },
    { month: "Jun", desktop: 214, mobile: 140 },
  ]

  const chartConfig = {
    desktop: { label: "Desktop", color: "var(--chart-1)" },
    mobile: { label: "Mobile", color: "var(--chart-2)" },
  }

  const tableData = [
    { id: "USR-001", name: "Alice Johnson", role: "Engineer", status: "Active", lastActive: "2 hrs ago" },
    { id: "USR-002", name: "Bob Smith", role: "Designer", status: "Away", lastActive: "5 hrs ago" },
    { id: "USR-003", name: "Carol White", role: "Manager", status: "Active", lastActive: "1 hr ago" },
    { id: "USR-004", name: "Dan Brown", role: "Engineer", status: "Offline", lastActive: "1 day ago" },
  ]

  const scrollItems = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`)

  return (
    <TooltipProvider>
      <Toaster theme="light" position="bottom-right" />
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-r border-border bg-card/50 p-6 lg:block">
          <h1 className="font-serif text-xl font-medium tracking-tight text-foreground">
            Component Library
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            All available UI components with usage notes.
          </p>
          <nav className="mt-6 flex flex-col gap-0.5">
            {navSections.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {item.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="mx-auto w-full max-w-4xl p-6 sm:p-8 lg:p-10">
          <div className="mb-10">
            <h1 className="font-serif text-4xl font-medium tracking-tight text-foreground">
              Component Library
            </h1>
            <p className="mt-2 max-w-xl text-base text-muted-foreground">
              A living reference of every UI component available in this project.
              Each section includes a short note on when to use it.
            </p>
          </div>

          {/* Buttons */}
          <Section
            id="buttons"
            title="Buttons"
            description="Use Buttons for actions, form submissions, or navigation. Prefer default for primary actions, outline for secondary, ghost for low-emphasis, and destructive for dangerous actions."
          >
            <div className="flex flex-col gap-6">
              <div>
                <Subheading>Variants</Subheading>
                <div className="flex flex-wrap gap-3">
                  <Button>Default</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link</Button>
                </div>
              </div>
              <div>
                <Subheading>Sizes</Subheading>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="xs">Extra Small</Button>
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon"><Settings /></Button>
                </div>
              </div>
              <div>
                <Subheading>States &amp; Compositions</Subheading>
                <div className="flex flex-wrap gap-3">
                  <Button disabled>Disabled</Button>
                  <Button>
                    <Mail data-icon="inline-start" />
                    With Icon
                  </Button>
                  <Button variant="outline">
                    <Spinner />
                    <span className="ml-2">Loading</span>
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          {/* Badges */}
          <Section
            id="badges"
            title="Badges"
            description="Use Badges for statuses, tags, counts, or metadata. Use destructive for errors, secondary for neutral info, and outline for subtle tagging."
          >
            <div className="flex flex-wrap gap-3">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="ghost">Ghost</Badge>
              <Badge variant="link">Link</Badge>
              <Badge>
                <Check data-icon="inline-start" />
                Verified
              </Badge>
            </div>
          </Section>

          {/* Cards */}
          <Section
            id="cards"
            title="Cards"
            description="Use Cards to group related content, metrics, or actions. Keep them focused—one card, one purpose. Use CardAction for top-right controls."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue</CardTitle>
                  <CardDescription>Total revenue this month</CardDescription>
                  <CardAction>
                    <Button size="icon-xs" variant="ghost"><Settings /></Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p className="font-serif text-3xl font-medium tracking-tight">
                    $24,500
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    +12% from last month
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" size="sm">View report</Button>
                </CardFooter>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Compact Card</CardTitle>
                  <CardDescription>Smaller spacing for dense UIs</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Use size={'"sm"'} for dashboards or lists.
                  </p>
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* Form Inputs */}
          <Section
            id="forms"
            title="Form Inputs"
            description="Use Input for short text, Textarea for long-form, Select for picking from lists, and Checkbox / Switch / Radio for boolean or single-choice states."
          >
            <div className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="name-input">Input</Label>
                <Input id="name-input" placeholder="Enter your name" />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="bio-textarea">Textarea</Label>
                <Textarea id="bio-textarea" placeholder="Describe your issue in detail..." />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="fruit-select">Select</Label>
                <Select value={selectValue} onValueChange={(v) => setSelectValue(v ?? "")}>
                  <SelectTrigger id="fruit-select">
                    <SelectValue placeholder="Pick a fruit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Fruits</SelectLabel>
                      <SelectItem value="apple">Apple</SelectItem>
                      <SelectItem value="banana">Banana</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Veggies</SelectLabel>
                      <SelectItem value="carrot">Carrot</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="terms-checkbox">Checkbox</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="terms-checkbox"
                    checked={checkboxChecked}
                    onCheckedChange={setCheckboxChecked}
                  />
                  <label htmlFor="terms-checkbox" className="text-sm text-muted-foreground">
                    Accept terms and conditions
                  </label>
                </div>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="airplane-switch">Switch</Label>
                <div className="flex items-center gap-3">
                  <Switch
                    id="airplane-switch"
                    checked={switchChecked}
                    onCheckedChange={setSwitchChecked}
                  />
                  <label htmlFor="airplane-switch" className="text-sm text-muted-foreground">
                    Airplane mode
                  </label>
                </div>
              </div>
              <div className="grid gap-3">
                <Label>Radio Group</Label>
                <RadioGroup value={radioValue} onValueChange={setRadioValue}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="default" id="radio-default" />
                    <label htmlFor="radio-default" className="text-sm text-muted-foreground">Default</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="comfortable" id="radio-comfortable" />
                    <label htmlFor="radio-comfortable" className="text-sm text-muted-foreground">Comfortable</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="compact" id="radio-compact" />
                    <label htmlFor="radio-compact" className="text-sm text-muted-foreground">Compact</label>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="volume-slider">Slider</Label>
                <Slider
                  id="volume-slider"
                  value={sliderValue}
                  onValueChange={(v) => setSliderValue(Array.isArray(v) ? v : [v])}
                />
                <p className="text-xs text-muted-foreground">Value: {sliderValue[0]}</p>
              </div>
              <div className="grid gap-3">
                <Label>Toggle</Label>
                <Toggle pressed={togglePressed} onPressedChange={setTogglePressed}>
                  <Star />
                  Star
                </Toggle>
              </div>
              <div className="grid gap-3">
                <Label>Toggle Group</Label>
                <ToggleGroup value={toggleGroupValue} onValueChange={setToggleGroupValue}>
                  <ToggleGroupItem value="bold"><Bold /></ToggleGroupItem>
                  <ToggleGroupItem value="italic"><Italic /></ToggleGroupItem>
                  <ToggleGroupItem value="underline"><Underline /></ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </Section>

          {/* Data Display */}
          <Section
            id="data-display"
            title="Data Display"
            description="Use Table for structured data, Avatar for people or entities, Skeleton for loading states, and Empty for zero-results states."
          >
            <div className="grid gap-6">
              <div>
                <Subheading>Table</Subheading>
                <Table>
                  <TableCaption>A list of recent users.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.id}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.role}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "Active"
                                ? "default"
                                : row.status === "Away"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.lastActive}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <Subheading>Avatar</Subheading>
                <div className="flex items-center gap-4">
                  <Avatar size="sm">
                    <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alice" />
                    <AvatarFallback>AJ</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Bob" />
                    <AvatarFallback>BS</AvatarFallback>
                    <AvatarBadge />
                  </Avatar>
                  <Avatar size="lg">
                    <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Carol" />
                    <AvatarFallback>CW</AvatarFallback>
                  </Avatar>
                  <AvatarGroup>
                    <Avatar size="sm"><AvatarFallback>A</AvatarFallback></Avatar>
                    <Avatar size="sm"><AvatarFallback>B</AvatarFallback></Avatar>
                    <Avatar size="sm"><AvatarFallback>C</AvatarFallback></Avatar>
                    <AvatarGroupCount>+5</AvatarGroupCount>
                  </AvatarGroup>
                </div>
              </div>
              <div>
                <Subheading>Skeleton</Subheading>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[300px]" />
                </div>
              </div>
              <div>
                <Subheading>Empty State</Subheading>
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText />
                    </EmptyMedia>
                    <EmptyTitle>No documents found</EmptyTitle>
                    <EmptyDescription>
                      Upload a file to get started.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="outline">Upload file</Button>
                  </EmptyContent>
                </Empty>
              </div>
            </div>
          </Section>

          {/* Charts */}
          <Section
            id="charts"
            title="Charts"
            description="Use ChartContainer for any Recharts visualization. It wires theming and tooltip formatting into the design system."
          >
            <div className="grid gap-6">
              <div>
                <Subheading>Bar Chart</Subheading>
                <ChartContainer config={chartConfig}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
                    <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </div>
              <div>
                <Subheading>Line Chart</Subheading>
                <ChartContainer config={chartConfig}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="desktop"
                      stroke="var(--color-desktop)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="mobile"
                      stroke="var(--color-mobile)"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </div>
          </Section>

          {/* Feedback */}
          <Section
            id="feedback"
            title="Feedback"
            description="Use Alert for inline messages, Progress for task completion, and Spinner for loading indicators in buttons or cards."
          >
            <div className="grid gap-6">
              <Alert>
                <AlertTriangle />
                <AlertTitle>Heads up!</AlertTitle>
                <AlertDescription>
                  Your trial ends in 3 days. Upgrade to keep access.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Unable to connect to the server. Please try again later.
                </AlertDescription>
              </Alert>
              <div>
                <Subheading>Progress</Subheading>
                <Progress value={60}>
                  <ProgressLabel>Uploading file...</ProgressLabel>
                  <ProgressValue />
                </Progress>
              </div>
              <div>
                <Subheading>Spinner</Subheading>
                <div className="flex items-center gap-2">
                  <Spinner />
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Overlays */}
          <Section
            id="overlays"
            title="Overlays"
            description="Use Dialog for critical modals, Sheet for side panels, Drawer for mobile-first bottom panels, Popover for contextual menus, Tooltip for hints, and HoverCard for rich previews."
          >
            <div className="grid gap-6">
              <div>
                <Subheading>Dialog, Sheet, Drawer</Subheading>
                <div className="flex flex-wrap gap-3">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger render={<Button variant="outline" />}>
                      Open Dialog
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Action</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete this item? This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose render={<Button variant="outline" />}>
                          Cancel
                        </DialogClose>
                        <Button variant="destructive">Delete</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger render={<Button variant="outline" />}>
                      Open Sheet
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Filter Settings</SheetTitle>
                        <SheetDescription>
                          Adjust filters to narrow results.
                        </SheetDescription>
                      </SheetHeader>
                      <div className="p-4">
                        <p className="text-sm text-muted-foreground">Sheet content goes here.</p>
                      </div>
                      <SheetFooter>
                        <SheetClose render={<Button variant="outline" />}>
                          Cancel
                        </SheetClose>
                        <Button>Apply</Button>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>

                  <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <DrawerTrigger asChild>
                      <Button variant="outline">Open Drawer</Button>
                    </DrawerTrigger>
                    <DrawerContent>
                      <DrawerHeader>
                        <DrawerTitle>Mobile Panel</DrawerTitle>
                        <DrawerDescription>
                          Drawers work great on phones and tablets.
                        </DrawerDescription>
                      </DrawerHeader>
                      <div className="p-4">
                        <p className="text-sm text-muted-foreground">Drawer content goes here.</p>
                      </div>
                      <DrawerFooter>
                        <DrawerClose asChild>
                          <Button variant="outline">Close</Button>
                        </DrawerClose>
                      </DrawerFooter>
                    </DrawerContent>
                  </Drawer>
                </div>
              </div>

              <div>
                <Subheading>Popover, Tooltip, HoverCard</Subheading>
                <div className="flex flex-wrap gap-3">
                  <Popover>
                    <PopoverTrigger render={<Button variant="outline" />}>
                      Open Popover
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <PopoverHeader>
                        <PopoverTitle>Dimensions</PopoverTitle>
                        <PopoverDescription>
                          Set the dimensions for the layer.
                        </PopoverDescription>
                      </PopoverHeader>
                      <div className="grid gap-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="grid gap-1">
                            <Label>Width</Label>
                            <Input defaultValue="100%" />
                          </div>
                          <div className="grid gap-1">
                            <Label>Height</Label>
                            <Input defaultValue="100%" />
                          </div>
                          <div className="grid gap-1">
                            <Label>Depth</Label>
                            <Input defaultValue="100%" />
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Tooltip>
                    <TooltipTrigger render={<Button variant="outline" />}>
                      Hover for Tooltip
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This is a tooltip with extra info.</p>
                    </TooltipContent>
                  </Tooltip>

                  <HoverCard>
                    <HoverCardTrigger render={<Button variant="link" />}>@iurysouza</HoverCardTrigger>
                    <HoverCardContent>
                      <div className="flex gap-3">
                        <Avatar>
                          <AvatarFallback>IS</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">Iury Souza</p>
                          <p className="text-xs text-muted-foreground">Software Engineer</p>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              </div>
            </div>
          </Section>

          {/* Navigation */}
          <Section
            id="navigation"
            title="Navigation"
            description="Use Tabs for switching views, Accordion for collapsible FAQ-like content, Pagination for long lists, DropdownMenu for action menus, and NavigationMenu for top-level site nav."
          >
            <div className="grid gap-6">
              <div>
                <Subheading>Definition List</Subheading>
                <DefinitionList
                  items={[
                    { term: "Agent", description: "An autonomous entity." },
                    { term: "Prompt", description: "Instructions given to an LLM." },
                  ]}
                />
              </div>

              <div>
                <Subheading>File Tree</Subheading>
                <FileTree
                  items={[
                    {
                      name: "src",
                      type: "directory",
                      children: [
                        { name: "index.ts", type: "file" },
                        { name: "utils.ts", type: "file" },
                      ],
                    },
                    { name: "package.json", type: "file" },
                  ]}
                />
              </div>

              <div>
                <Subheading>Tabs</Subheading>
                <Tabs value={tabValue} onValueChange={setTabValue}>
                  <TabsList>
                    <TabsTrigger value="account">Account</TabsTrigger>
                    <TabsTrigger value="password">Password</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>
                  <TabsContent value="account">
                    <p className="text-sm text-muted-foreground">Manage your account settings and preferences.</p>
                  </TabsContent>
                  <TabsContent value="password">
                    <p className="text-sm text-muted-foreground">Change your password and security settings.</p>
                  </TabsContent>
                  <TabsContent value="settings">
                    <p className="text-sm text-muted-foreground">General application settings.</p>
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                <Subheading>Accordion</Subheading>
                <Accordion value={accordionValue} onValueChange={setAccordionValue}>
                  <AccordionItem value="item-1">
                    <AccordionTrigger>What is this project?</AccordionTrigger>
                    <AccordionContent>
                      A data-driven visual artifact renderer that turns JSON into polished pages.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>How do I add artifacts?</AccordionTrigger>
                    <AccordionContent>
                      Drop validated JSON into ~/.pi/artifacts/ and they appear automatically.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger>Can I customize the theme?</AccordionTrigger>
                    <AccordionContent>
                      Yes, edit the CSS variables in globals.css and toggle dark mode.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              <div>
                <Subheading>Pagination</Subheading>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPaginationPage(Math.max(1, paginationPage - 1))}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink
                        isActive={paginationPage === 1}
                        onClick={() => setPaginationPage(1)}
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink
                        isActive={paginationPage === 2}
                        onClick={() => setPaginationPage(2)}
                      >
                        2
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink
                        isActive={paginationPage === 3}
                        onClick={() => setPaginationPage(3)}
                      >
                        3
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPaginationPage(Math.min(10, paginationPage + 1))}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>

              <div>
                <Subheading>Dropdown Menu</Subheading>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" />}>
                    Open Menu
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>My Account</DropdownMenuLabel>
                      <DropdownMenuItem>
                        <User />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <CreditCard />
                        Billing
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Settings />
                        Settings
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Preferences</DropdownMenuLabel>
                      <DropdownMenuCheckboxItem
                        checked={dropdownChecked}
                        onCheckedChange={setDropdownChecked}
                      >
                        Show notifications
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuRadioGroup
                        value={dropdownRadio}
                        onValueChange={setDropdownRadio}
                      >
                        <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      <LogOut />
                      Log out
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Users />
                        Team
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem>Invite</DropdownMenuItem>
                        <DropdownMenuItem>Manage</DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div>
                <Subheading>Navigation Menu</Subheading>
                <NavigationMenu>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <NavigationMenuTrigger>Overview</NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <NavigationMenuLink>
                          <Home />
                          Introduction
                        </NavigationMenuLink>
                        <NavigationMenuLink>
                          <LayoutDashboard />
                          Dashboard
                        </NavigationMenuLink>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                    <NavigationMenuItem>
                      <NavigationMenuLink>
                        <FileText />
                        Documentation
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                    <NavigationMenuItem>
                      <NavigationMenuLink>
                        <Mail />
                        Contact
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>
              </div>
            </div>
          </Section>

          {/* Layout */}
          <Section
            id="layout"
            title="Layout"
            description="Use Separator for visual breaks, ScrollArea for custom scrollbars, and Collapsible for hide/show sections without modal behavior."
          >
            <div className="grid gap-6">
              <div>
                <Subheading>Separator</Subheading>
                <div className="flex items-center gap-4">
                  <span className="text-sm">Left</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-sm">Right</span>
                </div>
                <Separator className="mt-3" />
              </div>

              <div>
                <Subheading>Scroll Area</Subheading>
                <ScrollArea className="h-32 rounded-md border">
                  <div className="p-4">
                    {scrollItems.map((item) => (
                      <div key={item} className="py-2 text-sm text-muted-foreground">
                        {item}
                      </div>
                    ))}
                  </div>
                  <ScrollBar />
                </ScrollArea>
              </div>

              <div>
                <Subheading>Collapsible</Subheading>
                <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
                  <CollapsibleTrigger render={<Button variant="ghost" />}>
                    {collapsibleOpen ? "Hide" : "Show"} details
                    <ChevronDown
                      className={cn("ml-2 transition", collapsibleOpen && "rotate-180")}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="mt-2 text-sm text-muted-foreground">
                      This content is hidden by default and revealed when the trigger is clicked.
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          </Section>

          {/* Toast */}
          <Section
            id="toast"
            title="Toast"
            description="Use Toast (via Sonner) for ephemeral notifications. Great for success, error, or info messages that don't block the UI."
          >
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => toast("Event has been created")}>Default</Button>
              <Button variant="outline" onClick={() => toast.success("Changes saved")}>Success</Button>
              <Button variant="outline" onClick={() => toast.error("Something went wrong")}>Error</Button>
              <Button variant="outline" onClick={() => toast.info("New update available")}>Info</Button>
              <Button variant="outline" onClick={() => toast.warning("Storage is almost full")}>Warning</Button>
              <Button variant="outline" onClick={() => toast.loading("Loading...", { duration: 2000 })}>Loading</Button>
              <Button
                variant="destructive"
                onClick={() =>
                  toast("Undo", {
                    action: { label: "Undo", onClick: () => toast("Undone") },
                  })
                }
              >
                With Action
              </Button>
            </div>
          </Section>

          {/* Calendar */}
          <Section
            id="calendar"
            title="Calendar"
            description="Use Calendar for date picking or date display. Wrap it in a Popover for a date-picker input pattern."
          >
            <div className="grid gap-6">
              <div>
                <Subheading>Single Date</Subheading>
                <Calendar
                  mode="single"
                  selected={calendarDate}
                  onSelect={setCalendarDate}
                />
              </div>
            </div>
          </Section>

          {/* Markdown */}
          <Section
            id="markdown"
            title="Markdown"
            description="Use Prose for rich text, documentation, or any content authored in Markdown. It supports standard Markdown plus GitHub-flavored extras like tables, task lists, and strikethrough."
          >
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <Prose>{markdownExample}</Prose>
            </div>
          </Section>

          {/* Code Block */}
          <Section
            id="code-block"
            title="Code Block"
            description="Use CodeBlock for syntax-highlighted code snippets. It uses Shiki under the hood and supports copy-to-clipboard."
          >
            <CodeBlock
              code={`const greeting = "Hello, world!";
console.log(greeting);`}
              language="typescript"
              title="example.ts"
            />
          </Section>

          {/* Diagrams */}
          <Section
            id="diagrams"
            title="Diagrams"
            description="Use Mermaid for quick text-defined charts. Use svg-diagram for interactive, animated, or custom-layout SVGs when Mermaid is too constrained."
          >
            <div className="grid gap-8">
              <div>
                <Subheading>Mermaid</Subheading>
                <p className="mb-3 text-sm text-muted-foreground">
                  Best for flowcharts, sequences, ERDs, and C4 diagrams that can be authored as text.
                </p>
                <CodeBlock
                  code={`{\n  "type": "mermaid",\n  "props": {\n    "title": "Request flow",\n    "code": "flowchart LR\\n  Client --> API\\n  API --> DB"\n  }\n}`}
                  language="json"
                  title="mermaid node"
                />
              </div>

              <div>
                <Subheading>SVG Diagram</Subheading>
                <p className="mb-3 text-sm text-muted-foreground">
                  A full HTML/SVG document rendered in a sandboxed iframe. Supports animations, clickable nodes, and custom themes.
                </p>
                <SvgDiagram
                  html={visualizerPipelineDiagram}
                  title="Visualizer pipeline"
                  caption="Click nodes and use the flow chips to explore."
                  height={640}
                />
              </div>
            </div>
          </Section>
        </main>
      </div>
    </TooltipProvider>
  )
}
