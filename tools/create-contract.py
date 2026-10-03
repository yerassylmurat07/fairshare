"""Generate the reviewable OpenAPI document from explicit contract definitions."""
from pathlib import Path
import yaml

S = {'type': 'string'}
ID = {'type': 'string', 'format': 'uuid'}
DATE = {'type': 'string', 'format': 'date'}
TIME = {'type': 'string', 'format': 'date-time'}
NULL_ID = {'type': ['string', 'null'], 'format': 'uuid'}
def ref(name): return {'$ref': '#/components/schemas/' + name}
def array(item): return {'type': 'array', 'items': item}
def obj(properties, required=None):
    return {'type': 'object', 'properties': properties, 'required': list(properties) if required is None else required}

schemas = {
 'Error': obj({'error': S}), 'Ok': obj({'ok': {'type': 'boolean'}}), 'Id': obj({'id': ID}),
 'User': obj({'id': ID, 'name': S, 'email': {'type':'string','format':'email'}, 'initials':S, 'color':S, 'skills':array(S)}),
 'Project': obj({'id':ID, 'teamId':ID, 'name':S, 'course':S, 'teamName':S}),
 'Milestone': obj({'id':ID, 'projectId':ID, 'title':S, 'dueDate':DATE, 'weekStart':DATE, 'revision':{'type':'integer','minimum':1}}),
 'Member': {'allOf':[ref('User'), obj({'role':{'enum':['leader','member']}, 'capacity':{'type':'number'}, 'load':{'type':'number'}})]},
 'TaskInput': obj({'title':{'type':'string','minLength':3,'maxLength':120}, 'goal':{'type':'string','minLength':3,'maxLength':800}, 'firstStep':{'type':'string','minLength':3,'maxLength':800}, 'deliverable':{'type':'string','minLength':3,'maxLength':800}, 'estimate':{'type':'number','exclusiveMinimum':0,'maximum':100,'multipleOf':0.25}, 'skill':{'enum':['Любой навык','Архитектура','Backend','Frontend','Тестирование','Документация','Базы данных']}, 'dependencyId':NULL_ID}, ['title','goal','firstStep','deliverable','estimate','skill']),
 'Assignment':obj({'taskId':ID,'memberId':NULL_ID,'reason':S,'estimate':{'type':'number'}}),
 'Allocation':obj({'id':ID,'milestoneId':ID,'revision':{'type':'integer'},'status':{'enum':['pending','approved']},'assignments':array(ref('Assignment')),'loads':array(obj({'memberId':ID,'name':S,'capacity':{'type':'number'},'before':{'type':'number'},'after':{'type':'number'}})),'warnings':array(S)}),
 'Resource':obj({'id':ID,'projectId':ID,'authorId':ID,'title':S,'url':{'type':'string','format':'uri'},'author':S,'createdAt':TIME}),
 'Decision':obj({'id':ID,'projectId':ID,'authorId':ID,'title':S,'context':S,'status':{'enum':['open','accepted','declined']},'author':S,'yes':{'type':'integer'},'no':{'type':'integer'},'myVote':{'enum':['yes','no',None]},'createdAt':TIME,'closedAt':{'type':['string','null'],'format':'date-time'}}),
}
schemas['Task']={'allOf':[ref('TaskInput'),obj({'id':ID,'projectId':ID,'milestoneId':ID,'assigneeId':NULL_ID,'status':{'enum':['planned','in_progress','done']},'helpReason':{'type':['string','null']},'evidence':S,'version':{'type':'integer'},'createdAt':TIME})]}
schemas['Workspace']=obj({'user':ref('User'),'projects':array(ref('Project'))})
schemas['ProjectState']=obj({'project':ref('Project'),'milestone':ref('Milestone'),'milestones':array(ref('Milestone')),'members':array(ref('Member')),'tasks':array(ref('Task')),'role':{'enum':['leader','member']}})
patch = dict(schemas['TaskInput']['properties'])
patch.update({'version':{'type':'integer','minimum':1},'status':{'enum':['planned','in_progress','done']},'assigneeId':NULL_ID,'helpReason':{'type':['string','null'],'minLength':3,'maxLength':400},'evidence':{'type':'string','maxLength':1200},'override':{'type':'boolean','default':False}})
schemas['TaskPatch']=obj(patch,['version'])
schemas['TaskCreate']={'allOf':[ref('TaskInput'),obj({'milestoneId':ID})]}
credentials={'email':{'type':'string','format':'email'},'password':{'type':'string','minLength':10,'maxLength':128}}
schemas['Login']=obj(credentials)
schemas['Register']=obj({**credentials,'name':{'type':'string','minLength':2,'maxLength':80},'teamName':{'type':'string','minLength':2,'maxLength':80}})
schemas['Discussion']=obj({'comments':array(obj({'id':ID,'taskId':ID,'authorId':ID,'name':S,'initials':S,'color':S,'body':S,'createdAt':TIME})),'checklist':array(obj({'id':ID,'taskId':ID,'title':S,'done':{'type':'boolean'},'createdAt':TIME}))})
paths = {}
def operation(path, method, summary, tag, response='Ok', body=None, public=False, description='', query=None):
    result={'summary':summary,'tags':[tag],'operationId':method+'_'+path.strip('/').replace('/','_').replace('{','').replace('}',''), 'responses':{'200':{'description':'Успех','content':{'application/json':{'schema':ref(response) if isinstance(response,str) else response}}}}}
    for status, desc in [('400','Некорректные входные данные'),('401','Сессия отсутствует или истекла'),('403','Нет полномочий'),('404','Объект недоступен'),('409','Конфликт версии или состояния'),('410','Приглашение недействительно'),('429','Превышена частота запросов'),('500','Внутренняя ошибка')]:
        result['responses'][status]={'description':desc,'content':{'application/json':{'schema':ref('Error')}}}
    if public: result['security']=[]
    if description:result['description']=description
    params=[]
    import re
    for name in re.findall(r'\{(\w+)\}',path):params.append({'name':name,'in':'path','required':True,'schema':ID})
    for name,schema,required in query or []:params.append({'name':name,'in':'query','required':required,'schema':schema})
    if params:result['parameters']=params
    if body:result['requestBody']={'required':True,'content':{'application/json':{'schema':ref(body) if isinstance(body,str) else body}}}
    paths.setdefault(path,{})[method]=result

operation('/health','get','Проверка доступности базы','System',public=True)
operation('/config','get','Доступность деморежима','System',obj({'demoEnabled':{'type':'boolean'}}),public=True)
operation('/auth/session','get','Текущая сессия без ошибки для гостя','Identity',obj({'user':{'anyOf':[ref('User'),{'type':'null'}]}}),public=True)
operation('/auth/register','post','Создать аккаунт и свою команду','Identity',obj({'user':ref('User')}),'Register',True)
operation('/auth/login','post','Войти','Identity',obj({'user':ref('User')}),'Login',True)
operation('/auth/logout','post','Удалить текущую сессию','Identity',public=True)
operation('/auth/demo','post','Войти в учебную команду','Identity',obj({'user':ref('User')}),public=True,description='Маршрут отсутствует при выключенном деморежиме.')
operation('/workspace','get','Аккаунт и доступные проекты','Workspace','Workspace')
operation('/me/tasks','get','Мои задачи во всех доступных проектах','Tasks',array({'allOf':[ref('Task'),obj({'projectName':S,'milestoneTitle':S})]}))
operation('/me/availability','put','Обновить свои часы на неделю и навыки','Workspace',body=obj({'weekStart':DATE,'hours':{'type':'number','minimum':0,'maximum':100,'multipleOf':.25},'skills':array(schemas['TaskInput']['properties']['skill'])}),description='weekStart — понедельник UTC; hours — общая доступность во всех проектах, не отдельная доступность в одной команде.')
operation('/projects','post','Создать проект в своей команде','Projects','Id',obj({'teamId':ID,'name':{'type':'string','minLength':2,'maxLength':100},'course':{'type':'string','maxLength':60}},['teamId','name']))
operation('/projects/{id}/state','get','Этап, задачи и недельная нагрузка','Projects','ProjectState',query=[('milestoneId',ID,False)])
operation('/projects/{id}/milestones','post','Создать недельный этап','Projects','Id',obj({'title':{'type':'string','minLength':2,'maxLength':100},'weekStart':DATE,'dueDate':DATE}),description='Только координатор; dueDate внутри выбранной недели.')
operation('/projects/{id}/tasks','post','Создать понятную задачу','Tasks','Id','TaskCreate')
operation('/projects/{id}/tasks/{taskId}','patch','Обновить задачу с проверкой версии','Tasks',body='TaskPatch',description='Участник может менять только статус, помощь и результат своей задачи. Условия и назначение — координатор. override нужен для ручного исключения по навыку или часам. Зависимость, не переданная в PATCH, сохраняется.')
operation('/projects/{id}/tasks/{taskId}','delete','Удалить запланированную задачу','Tasks',query=[('version',{'type':'integer','minimum':1},True)],description='Только координатор; запрещено при зависимых задачах.')
operation('/projects/{id}/allocations','post','Построить предложение распределения','Allocation','Allocation',obj({'milestoneId':ID}),description='Только координатор; реальные назначения не меняются.')
operation('/projects/{id}/allocations/{allocationId}/approve','post','Атомарно принять предложение','Allocation','Allocation',description='409 при изменившемся снимке; повторное принятие уже принятого предложения идемпотентно.')
operation('/projects/{id}/invitations','post','Создать одноразовое приглашение','Workspace',obj({'token':S,'expiresInHours':{'type':'integer'}}),description='Только координатор; 24 часа. Сырой токен возвращается только при создании.')
operation('/invitations/accept','post','Принять приглашение','Workspace',body=obj({'token':{'type':'string','minLength':30,'maxLength':100}}))
operation('/projects/{id}/events','get','Последние 50 действий проекта','Collaboration',array(obj({'kind':S,'details':{'type':'object'},'created_at':TIME,'actor':S})))
operation('/projects/{id}/tasks/{taskId}/discussion','get','Обсуждение и шаги','Collaboration','Discussion')
operation('/projects/{id}/tasks/{taskId}/comments','post','Добавить комментарий','Collaboration',body=obj({'body':{'type':'string','minLength':1,'maxLength':2000}}))
operation('/projects/{id}/tasks/{taskId}/checklist','post','Добавить конкретный шаг','Collaboration',body=obj({'title':{'type':'string','minLength':2,'maxLength':160}}))
operation('/projects/{id}/tasks/{taskId}/checklist/{itemId}','patch','Изменить состояние шага','Collaboration',body=obj({'done':{'type':'boolean'}}))
operation('/projects/{id}/collaboration','get','Материалы и решения проекта','Collaboration',obj({'resources':array(ref('Resource')),'decisions':array(ref('Decision'))}))
operation('/projects/{id}/resources','post','Добавить внешний материал','Collaboration',body=obj({'title':{'type':'string','minLength':2,'maxLength':100},'url':{'type':'string','format':'uri','maxLength':1000}}),description='Только HTTP/HTTPS; сервер не загружает содержимое URL.')
operation('/projects/{id}/decisions','post','Предложить командное решение','Collaboration',body=obj({'title':{'type':'string','minLength':3,'maxLength':120},'context':{'type':'string','minLength':1,'maxLength':2000}}))
operation('/projects/{id}/decisions/{decisionId}/vote','post','Проголосовать или заменить свой голос','Collaboration',body=obj({'choice':{'enum':['yes','no']}}),description='Голосование только пока решение открыто.')
operation('/projects/{id}/decisions/{decisionId}','patch','Зафиксировать итог решения','Collaboration',body=obj({'status':{'enum':['accepted','declined']}}),description='Только координатор. Итог фиксируется после обсуждения; подсчёт голосов не закрывает решение автоматически.')

document={'openapi':'3.1.0','info':{'title':'FairShare MVP API','version':'0.1.0','description':'Рабочий MVP. Same-origin cookie sessions, роль и членство проверяются сервером.'},'servers':[{'url':'http://localhost:3000/api'}],'security':[{'sessionCookie':[]}],'paths':paths,'components':{'securitySchemes':{'sessionCookie':{'type':'apiKey','in':'cookie','name':'fairshare_session'}},'schemas':schemas}}
target=Path(__file__).parents[1]/'contracts/openapi.yaml'
target.write_text(yaml.safe_dump(document,allow_unicode=True,sort_keys=False),encoding='utf-8')
print(f'Wrote {len(paths)} paths / {sum(len(p) for p in paths.values())} operations')
