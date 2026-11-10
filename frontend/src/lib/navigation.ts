import {
  LayoutDashboard,
  Database,
  ShieldCheck,
  Sparkles,
  ClipboardCheck,
  BarChart3,
  Brain,
  FileText,
  History,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
}

export const navItems: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    short: "Inicio",
    icon: LayoutDashboard,
    description: "Resumen del dataset activo",
  },
  {
    to: "/datos",
    label: "Datos",
    short: "Datos",
    icon: Database,
    description: "Cargar y conectar fuentes",
  },
  {
    to: "/calidad",
    label: "Calidad",
    short: "Calidad",
    icon: ShieldCheck,
    description: "Diagnóstico automático",
  },
  {
    to: "/limpieza",
    label: "Limpieza",
    short: "Limpieza",
    icon: Sparkles,
    description: "Correcciones controladas",
  },
  {
    to: "/validacion",
    label: "Validación",
    short: "Validar",
    icon: ClipboardCheck,
    description: "Reglas y comprobaciones",
  },
  {
    to: "/eda",
    label: "EDA",
    short: "EDA",
    icon: BarChart3,
    description: "Exploración de variables",
  },
  {
    to: "/ml",
    label: "Machine Learning",
    short: "ML",
    icon: Brain,
    description: "Técnicas recomendadas",
  },
  {
    to: "/asistente",
    label: "AI Assistant",
    short: "IA",
    icon: MessagesSquare,
    description: "Preguntas sobre el dataset",
  },
  {
    to: "/informes",
    label: "Informes",
    short: "Informes",
    icon: FileText,
    description: "Reporte de calidad",
  },
  {
    to: "/historial",
    label: "Historial",
    short: "Historial",
    icon: History,
    description: "Operaciones ejecutadas",
  },
];
