import DataTable from '@/components/DataTable';
import { useI18n } from '@/lib/i18n';

type EmployeeRow = {
  name: string;
  role: string;
  status: string;
};

export default function EmployeesPage() {
  const { t } = useI18n();
  const rows: EmployeeRow[] = [];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('hr.employeesTitle')}</h1>
      <DataTable
        columns={[
          { key: 'name', label: t('hr.employeesTitle') },
          { key: 'role', label: t('hr.role') },
          { key: 'status', label: t('hr.status') },
        ]}
        rows={rows}
        emptyLabel={t('hr.empty')}
      />
    </div>
  );
}

