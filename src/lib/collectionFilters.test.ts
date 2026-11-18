import { describe, expect, it } from "vitest";
import { localDayKey, projectResults, searchText, taskResults, type TaskFilters } from "./collectionFilters";
const base: TaskFilters = {search:"",status:"all",priority:"all",assignee:"all",deadline:"all",sort:"position"};
const task = (id: string, values: object={}) => ({id,title:"Task "+id,description:"",status:"todo",priority:"medium",position:1,createdAt:1,...values});
const rows = [
 {...task('overdue'),assigneeId:'me',dueDate:'2026-12-31',priority:'urgent',position:2},
 {...task('today'),assigneeId:'me',dueDate:'2027-01-01',priority:'high',position:3},
 {...task('six'),assigneeId:'other',dueDate:'2027-01-07',position:4},
 {...task('seven'),assigneeId:'other',dueDate:'2027-01-08',position:5},
 {...task('done'),status:'done',dueDate:'2026-12-30',position:6},
 {...task('none'),description:'Thiết kế đường dẫn',position:1},
];
const results=(changes:Partial<TaskFilters>)=>taskResults(rows,{...base,...changes},'me','2027-01-01').map(row=>row.id);
describe('Collection filters',()=>{
 it('combines archived project status and search, sorts independently and keeps query rows unchanged',()=>{
  const projects=[{name:'Website',description:'Launch',status:'active',_creationTime:30},{name:'Archive 10',description:'Thiết kế',status:'archived',_creationTime:10},{name:'Archive 2',description:'Thiết kế',status:'archived',_creationTime:20}];
  const before=structuredClone(projects);
  expect(projectResults(projects,' THIET KE ','archived','name').map(row=>row.name)).toEqual(['Archive 2','Archive 10']);
  expect(projectResults(projects,'','all','oldest').map(row=>row.name)).toEqual(['Archive 10','Archive 2','Website']);
  expect(projectResults(projects,'','all','newest').map(row=>row.name)).toEqual(['Website','Archive 2','Archive 10']);
  expect(projects).toEqual(before);
 });
 it('matches Vietnamese accents, Đ and trimmed search without altering user content',()=>{
  expect(searchText('  ĐƯỜNG DẪN ')).toBe('duong dan');
  expect(results({search:'thiet ke DUONG'})).toEqual(['none']);expect(rows[5].description).toBe('Thiết kế đường dẫn');
 });
 it('combines task filters rather than treating them as alternatives',()=>{
  expect(results({assignee:'me',priority:'high',deadline:'today',status:'todo'})).toEqual(['today']);
  expect(results({assignee:'me',priority:'high',status:'done'})).toEqual([]);
 });
 it('separates unassigned, current account and unavailable specific assignees',()=>{
  expect(results({assignee:'me'})).toEqual(['overdue','today']);
  expect(results({assignee:'unassigned'})).toEqual(['none','done']);
  expect(results({assignee:'other'})).toEqual(['six','seven']);
  expect(results({assignee:'removed'})).toEqual([]);
  expect(taskResults(rows,{...base,assignee:'me'},undefined,'2027-01-01')).toEqual([]);
 });
 it('excludes completed tasks from overdue and upcoming work, including year boundaries',()=>{
  expect(results({deadline:'overdue'})).toEqual(['overdue']);
  expect(results({deadline:'today'})).toEqual(['today']);
  expect(results({deadline:'week'})).toEqual(['today','six']);
  expect(results({deadline:'none'})).toEqual(['none']);
 });
 it('uses seven calendar days across leap day',()=>{
  const tasks=[{...task('leap'),dueDate:'2028-02-29'},{...task('last'),dueDate:'2028-03-04'},{...task('outside'),dueDate:'2028-03-05'}];
  expect(taskResults(tasks,{...base,deadline:'week'},undefined,'2028-02-27').map(row=>row.id)).toEqual(['leap','last']);
 });
 it('sorts missing due dates last, urgent priority first and preserves the source order',()=>{
  const before=structuredClone(rows);
  expect(results({sort:'due'})).toEqual(['done','overdue','today','six','seven','none']);
  expect(results({sort:'priority'})[0]).toBe('overdue');
  expect(rows).toEqual(before);expect(results({})).toEqual(['none','overdue','today','six','seven','done']);
 });
 it('sorts newest tasks with board position as a stable tie breaker',()=>{
  expect(taskResults([task('a',{createdAt:1}),task('b',{createdAt:3}),task('c',{createdAt:3,position:2})],{...base,sort:'newest'}).map(row=>row.id)).toEqual(['b','c','a']);
 });
 it('combines archived project status with normalized name or description searches',()=>{
  const projects=[{name:'Zeta',description:'Đồ án mới',status:'archived',_creationTime:2},{name:'Alpha',description:'New launch',status:'active',_creationTime:1}];
  expect(projectResults(projects,'do an','archived','newest').map(row=>row.name)).toEqual(['Zeta']);
  expect(projectResults(projects,'','all','name').map(row=>row.name)).toEqual(['Alpha','Zeta']);
  expect(projectResults(projects,'','all','newest').map(row=>row.name)).toEqual(['Zeta','Alpha']);
  expect(projectResults(projects,'','all','oldest').map(row=>row.name)).toEqual(['Alpha','Zeta']);
  expect(projects[0].name).toBe('Zeta');
 });
 it('uses the browser local calendar date, without shifting to the previous UTC day',()=>{
  expect(localDayKey(new Date(2026,10,18,0,1))).toBe('2026-11-18');
 });
});
