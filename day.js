(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.PikaDayTools=value;})(globalThis,function(){
 function localDay(date=new Date(),timeZone){const parts=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',...(timeZone?{timeZone}:{})}).formatToParts(date),get=t=>parts.find(p=>p.type===t).value;return `${get('year')}-${get('month')}-${get('day')}`;}
 function todayTask(task,day=localDay()){if(task.source!=='obsidian')return !task.due||task.due<=day;return task.todayTag||!!(task.due&&task.due<=day)||!!(task.scheduled&&task.scheduled<=day&&(!task.due||task.due<=day));}
 function exactTodayTask(task,day=localDay()){return !task.done&&(task.due===day||task.scheduled===day||task.todayTag||task.coreDay===day);}
 return {localDay,todayTask,exactTodayTask};
});
