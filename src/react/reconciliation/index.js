
import { createTaskQueue, arrified, createStateNode, getTag } from '../Misc'

const taskQueue = createTaskQueue()
/**
 * 要执行的子任务
 */
let subTask =  null

let pendingCommit = null

const commitAllWork = fiber =>{
    /**
     * 循环 effects 数组 构建DOM 节点树
     */
    fiber.effects.forEach(item =>{
        /**
         * 向页面中追加节点
         */
        if(item.effectTag === 'placement'){
            /**
             * 当前追加节点的子节点
             */
            let fiber = item
            /**
             * 当前要追加的子节点的父级
             */
            let parentFiber = item.parent
            /**
             * 找到普通节点父级 排除组件父级
             * 因为组件父级是不能直接追加真实DOM节点的
             */
            while (parentFiber.tag === "class_component" || parentFiber.tag === "function_component") {
                parentFiber = parentFiber.parent
            }
            /**
             * 如果子节点是普通节点 找到父级 将子级追加到父级中
             */
            if(fiber.tag === "host_component"){
                parentFiber.stateNode.appendChild(fiber.stateNode)
            }
            
        }
    })
}

const getFirstTash = () =>{
    /**
     * 从任务队列中获取任务
     */
    const task = taskQueue.pop()
    
    /**
     * 返回最外层的fiber 对象
     */

    return {
        props: task.props,
        stateNode: task.dom,
        tag:'host_root',
        effects:[],
        child:null
    }
}

const reconcileChildren = (fiber, children) =>{
    /**
     * children 可能是对象 也可能是数组
     * 将children 转换为数组
     */
    const arrifiedChildren = arrified(children)
    console.log(fiber, arrifiedChildren, '---arrifiedChildren')
    let index  = 0 
    let numberOfElements  = arrifiedChildren.length;
    let element = null
    let newFiber = null
    let prevFiber = null


    while (index < numberOfElements){
        element = arrifiedChildren[index]
        /**
         *  子级 fiber对象
         */
        newFiber = {
            type: element.type, //节点类型(元素, 文本, 组件)(具体的类型)
            props: element.props,// 节点属性
            tag : getTag(element), //节点标记(对具体类型的分类 hostRoot || hostComponent || classComponent || functionComponent)
            effects: [],// 数组, 存储需要更改的 fiber 对象
            effectTag:'placement',// 当前 Fiber 要被执行的操作(新增, 删除, 修改)
            parent: fiber,// 当前 Fiber 的父级 Fiber
            // child: element.children,//当前 Fiber 的子级 Fiber
        }
        /**
         * 为fiber节点添加DOM 对象或者组件实例对象
         */
        newFiber.stateNode = createStateNode(newFiber) //节点 DOM 对象 | 组件实例对象
         /**
          * 为父级 fiber 添加子级 fiber
          */
        if(index === 0){
            fiber.child = newFiber
        }else{
            /**
             * 为fiber添加一个兄弟fiber
             */
            prevFiber.sibling = newFiber //当前 Fiber 的下一个兄弟 Fiber
        }
        prevFiber = newFiber
        console.log(fiber,'0000')
        index++

    }

}
const executeTask = fiber =>{
    /**
     * 构建子级fiber对象
     */

    if (fiber.tag === 'class_component') {
        reconcileChildren(fiber, fiber.stateNode.render())
    }else if (fiber.tag === 'function_component') {
        reconcileChildren(fiber, fiber.stateNode(fiber.props))
    }else{
        reconcileChildren(fiber, fiber.props.children)
    }
  
    if(fiber.child){
        return fiber.child
    }
 
    let currentExecutelyFiber = fiber
    /**
    * 如果存在同级 返回同级 构建同级的子级
    * 如果同级不存在 返回父级 看父级是否有同级 
    */
    while(currentExecutelyFiber.parent){
        currentExecutelyFiber.parent.effects = currentExecutelyFiber.parent.effects.concat(
            currentExecutelyFiber.effects.concat([currentExecutelyFiber])
        )
        if(currentExecutelyFiber.sibling){
            return currentExecutelyFiber.sibling
        }
        currentExecutelyFiber = currentExecutelyFiber.parent
    }
    pendingCommit = currentExecutelyFiber
}
//循环任务
const workLoop = deadline =>{
    /**
     * 如果子任务不存在 就去获取子任务
     */
    if(!subTask){
        subTask = getFirstTash() 
    }
    /**
     * 如果任务存在并且浏览器有空余时间就调用
     * executeTask 方法执行任务 接收任务 返回新任务
     */
    while(subTask && deadline.timeRemaining() > 1){
        //执行任务，并返回新的任务
        subTask = executeTask(subTask)
    }    

    if(pendingCommit){
        commitAllWork(pendingCommit)
    }

}
//执行任务
const performTask = deadline =>{
    //执行任务
    workLoop(deadline)
    /**
     * 判断任务是否存在
     * 判断任务队列中是否还有任务没有执行
     * 再一次告诉浏览器在空闲的时间执行任务
     */

    if(subTask || !taskQueue.isEmpty()){
        requestIdleCallback(performTask)
    }
}

export const render = (element, dom)=>{
    /**
     * 1.向任务队列中添加任务
     * 2.指定在浏览器空闲时执行任务
     */

    /**
      *任务就是通过 vdom 对象 构建 fiber 对象 
      */

    taskQueue.push({
        dom,
        props:{children: element}
    })

    requestIdleCallback(performTask)

}