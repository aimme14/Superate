import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'

const data = [
  { name: 'Ene', mantenimientos: 65, informes: 40 },
  { name: 'Feb', mantenimientos: 59, informes: 38 },
  { name: 'Mar', mantenimientos: 80, informes: 43 },
  { name: 'Abr', mantenimientos: 81, informes: 45 },
  { name: 'May', mantenimientos: 56, informes: 39 },
  { name: 'Jun', mantenimientos: 55, informes: 37 },
  { name: 'Jul', mantenimientos: 40, informes: 30 },
  { name: 'Ago', mantenimientos: 45, informes: 32 },
  { name: 'Sep', mantenimientos: 62, informes: 41 },
  { name: 'Oct', mantenimientos: 75, informes: 44 },
  { name: 'Nov', mantenimientos: 85, informes: 48 },
  { name: 'Dic', mantenimientos: 70, informes: 42 },
]

export function Overview() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip />
        <Bar dataKey="mantenimientos" fill="#adfa1d" radius={[4, 4, 0, 0]} />
        <Bar dataKey="informes" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}