// 使用示例文件
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from './index'

// 示例数据类型
interface User {
  id: string
  name: string
  email: string
  role: string
}

// 示例数据
const exampleData: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'Admin',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'User',
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'User',
  },
]

// 示例列定义
const exampleColumns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => {
      const role = row.getValue('role') as string
      return (
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            role === 'Admin'
              ? 'bg-red-100 text-red-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {role}
        </div>
      )
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="flex gap-2">
          <button
            className="text-blue-600 hover:text-blue-800 text-sm"
            onClick={() => alert(`Edit ${user.name}`)}
          >
            Edit
          </button>
          <button
            className="text-red-600 hover:text-red-800 text-sm"
            onClick={() => alert(`Delete ${user.name}`)}
          >
            Delete
          </button>
        </div>
      )
    },
  },
]

// 使用示例：带分页
export function ExampleWithPagination() {
  return (
    <DataTable
      columns={exampleColumns}
      data={exampleData}
      pageSize={5}
      showPagination={true}
      className="w-full"
    />
  )
}

// 使用示例：不带分页
export function ExampleWithoutPagination() {
  return (
    <DataTable
      columns={exampleColumns}
      data={exampleData}
      showPagination={false}
      className="w-full"
    />
  )
}

// 默认导出示例
export default ExampleWithPagination
